import json
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.errors import DependencyUnavailableError


class PDModelUnavailableError(DependencyUnavailableError):
    """Raised when the configured credit model cannot serve a prediction."""


class PDModelClient:
    """Thin wrapper around the gmsc-pd-endpoint SageMaker real-time endpoint.

    Contract (see financial-risk-analyst-ml/src/financial_risk_analyst_ml/inference.py):
    request body is a raw JSON object (single borrower) or array (batch) of the
    10 GMSC feature keys - no wrapper key. Response mirrors that shape with
    {"pd", "status", "model_version", "risk_drivers"} per borrower.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._endpoint_name = settings.sagemaker_endpoint_name
        self._client = boto3.client(
            "sagemaker-runtime",
            region_name=settings.aws_region,
            config=BotoConfig(
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )

    def predict(self, features: dict | list[dict], explain: bool = False) -> dict | list[dict]:
        """features: a single borrower dict, or a list for a batch request.
        explain is only meaningful for a single-borrower request."""
        if isinstance(features, dict):
            payload = dict(features)
            if explain:
                payload["explain"] = True
        else:
            payload = list(features)
        try:
            response = self._client.invoke_endpoint(
                EndpointName=self._endpoint_name,
                ContentType="application/json",
                Accept="application/json",
                Body=json.dumps(payload),
            )
            result = json.loads(response["Body"].read())
            return _validate_prediction_shape(
                result, expected_count=1 if isinstance(features, dict) else len(features)
            )
        except (
            BotoCoreError,
            ClientError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            raise PDModelUnavailableError(
                f"Credit model is unavailable: SageMaker endpoint '{self._endpoint_name}' "
                "could not return a prediction."
            ) from exc


def _validate_prediction_shape(result: object, *, expected_count: int) -> dict | list[dict]:
    if expected_count == 1 and isinstance(result, dict):
        payloads = [result]
    elif isinstance(result, list) and len(result) == expected_count:
        payloads = result
    else:
        raise ValueError("PD model returned an unexpected response shape")

    if not all(isinstance(payload, dict) for payload in payloads):
        raise ValueError("PD model returned an invalid prediction payload")
    for payload in payloads:
        pd_value = payload.get("pd")
        if not isinstance(pd_value, (int, float)) or not 0 <= pd_value <= 1:
            raise ValueError("PD model returned an invalid probability")
    return payloads[0] if expected_count == 1 else payloads


@lru_cache
def get_pd_model_client() -> PDModelClient:
    return PDModelClient()
