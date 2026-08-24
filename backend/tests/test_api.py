import asyncio

from httpx import ASGITransport, AsyncClient, Response

from app.main import app


async def get(path: str) -> Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def test_health_returns_request_id():
    response = asyncio.run(get("/health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"]


def test_invalid_identifier_returns_structured_error():
    response = asyncio.run(get("/market/portfolios/not valid/risk"))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_input"
    assert response.json()["request_id"]
