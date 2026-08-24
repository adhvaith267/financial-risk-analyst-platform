import pytest

from app.services.sagemaker_client import _validate_prediction_shape


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
