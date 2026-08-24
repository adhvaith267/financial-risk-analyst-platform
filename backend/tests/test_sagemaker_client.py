from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError

from app.services.sagemaker_client import (
    PDModelClient,
    PDModelUnavailableError,
    _validate_prediction_shape,
)


def test_validates_single_prediction():
    result = _validate_prediction_shape(
        {"pd": 0.25, "status": "APPROVED"}, expected_count=1
    )

    assert result["pd"] == pytest.approx(0.25)


@pytest.mark.parametrize(
    ("result", "expected_count", "message"),
    [
        ({"pd": 1.2}, 1, "invalid probability"),
        ({"pd": "0.2"}, 1, "invalid probability"),
        ([{"pd": 0.1}], 2, "unexpected response shape"),
        ([{"status": "APPROVED"}], 1, "invalid probability"),
    ],
)
def test_rejects_invalid_prediction_contract(result, expected_count, message):
    with pytest.raises(ValueError, match=message):
        _validate_prediction_shape(result, expected_count=expected_count)


def test_translates_sagemaker_client_error_to_dependency_error():
    client = object.__new__(PDModelClient)
    client._endpoint_name = "gmsc-pd-endpoint"
    client._client = Mock()
    client._client.invoke_endpoint.side_effect = ClientError(
        {"Error": {"Code": "ValidationError", "Message": "Endpoint not found"}},
        "InvokeEndpoint",
    )

    with pytest.raises(PDModelUnavailableError, match="Credit model is unavailable"):
        client.predict({"feature": 1})
