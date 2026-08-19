import json

import boto3

from app.core.config import get_settings


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

    def predict(self, features: dict, explain: bool = False) -> dict:
        payload = dict(features)
        if explain:
            payload["explain"] = True
        response = self._client.invoke_endpoint(
            EndpointName=self._endpoint_name,
            ContentType="application/json",
            Accept="application/json",
            Body=json.dumps(payload),
        )
        return json.loads(response["Body"].read())


_client: PDModelClient | None = None


def get_pd_model_client() -> PDModelClient:
    global _client
    if _client is None:
        _client = PDModelClient()
    return _client
