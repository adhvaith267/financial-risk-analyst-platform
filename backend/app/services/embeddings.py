import json

import boto3

from app.core.config import get_settings

EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"


class EmbeddingClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = boto3.client("bedrock-runtime", region_name=settings.aws_region)

    def embed(self, text: str) -> list[float]:
        response = self._client.invoke_model(
            modelId=EMBEDDING_MODEL_ID,
            body=json.dumps({"inputText": text}),
        )
        return json.loads(response["body"].read())["embedding"]


_client: EmbeddingClient | None = None


def get_embedding_client() -> EmbeddingClient:
    global _client
    if _client is None:
        _client = EmbeddingClient()
    return _client
