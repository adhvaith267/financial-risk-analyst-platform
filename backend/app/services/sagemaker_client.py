import json

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings


class PDModelUnavailableError(RuntimeError):
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
        self._client = boto3.client("sagemaker-runtime", region_name=settings.aws_region)

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
            return json.loads(response["Body"].read())
        except (BotoCoreError, ClientError, json.JSONDecodeError) as exc:
            raise PDModelUnavailableError(
                f"Credit model is unavailable: SageMaker endpoint '{self._endpoint_name}' "
                "could not return a prediction."
            ) from exc


_client: PDModelClient | None = None


def get_pd_model_client() -> PDModelClient:
    global _client
    if _client is None:
        _client = PDModelClient()
    return _client
