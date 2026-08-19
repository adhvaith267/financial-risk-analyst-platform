from unittest.mock import patch

from app.engines.credit_risk import assess_borrower
from app.models.borrower import Borrower, Loan


def _borrower() -> Borrower:
    return Borrower(
        borrower_id="B102",
        name="Test Borrower",
        age=45,
        revolving_utilization_of_unsecured_lines=0.9,
        number_of_time_30_59_days_past_due_not_worse=2,
        debt_ratio=0.5,
        monthly_income=4000.0,
        number_of_open_credit_lines_and_loans=8,
        number_of_times_90_days_late=1,
        number_real_estate_loans_or_lines=1,
        number_of_time_60_89_days_past_due_not_worse=0,
        number_of_dependents=2,
    )


@patch("app.engines.credit_risk.get_pd_model_client")
def test_assess_borrower_computes_expected_loss(mock_get_client):
    mock_get_client.return_value.predict.return_value = {
        "pd": 0.083,
        "status": "DECLINED",
        "model_version": "gmsc-lgb-v1",
        "risk_drivers": ["High utilization", "Delinquency", "Debt burden"],
    }
    loan = Loan(loan_id="L1", borrower_id="B102", loan_type="personal",
                outstanding_balance=100_000.0, recovery_rate=0.60)

    result = assess_borrower(_borrower(), loan)

    assert result.pd == 0.083
    assert result.lgd == 0.40
    assert result.ead == 100_000.0
    assert round(result.expected_loss, 2) == round(0.083 * 0.40 * 100_000.0, 2)
    assert result.model_version == "gmsc-lgb-v1"
    assert result.risk_drivers == ["High utilization", "Delinquency", "Debt burden"]


@patch("app.engines.credit_risk.get_pd_model_client")
def test_assess_borrower_without_loan_uses_default_recovery_rate_and_zero_ead(mock_get_client):
    mock_get_client.return_value.predict.return_value = {
        "pd": 0.05,
        "status": "APPROVED",
        "model_version": "gmsc-lgb-v1",
        "risk_drivers": [],
    }

    result = assess_borrower(_borrower(), loan=None)

    assert result.lgd == 0.40  # default_recovery_rate = 0.60
    assert result.ead == 0.0
    assert result.expected_loss == 0.0


@patch("app.engines.credit_risk.get_pd_model_client")
def test_assess_borrower_sends_exact_sagemaker_payload_shape(mock_get_client):
    mock_get_client.return_value.predict.return_value = {"pd": 0.01, "status": "APPROVED", "model_version": "v1", "risk_drivers": []}

    assess_borrower(_borrower())

    sent_payload = mock_get_client.return_value.predict.call_args.args[0]
    assert set(sent_payload) == {
        "RevolvingUtilizationOfUnsecuredLines", "age", "NumberOfTime30-59DaysPastDueNotWorse",
        "DebtRatio", "MonthlyIncome", "NumberOfOpenCreditLinesAndLoans", "NumberOfTimes90DaysLate",
        "NumberRealEstateLoansOrLines", "NumberOfTime60-89DaysPastDueNotWorse", "NumberOfDependents",
    }
