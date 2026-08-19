from pydantic import BaseModel


class BorrowerSummary(BaseModel):
    borrower_id: str
    name: str
    has_active_loan: bool


class BorrowerProfile(BaseModel):
    borrower_id: str
    name: str
    age: int
    monthly_income: float | None
    revolving_utilization: float
    debt_ratio: float
    total_delinquencies: int
    outstanding_balance: float | None
    loan_type: str | None


class CreditAssessmentResponse(BaseModel):
    borrower_id: str
    borrower: BorrowerProfile
    pd: float
    lgd: float
    ead: float
    expected_loss: float
    status: str
    model_version: str
    risk_drivers: list[str]
    decline_threshold: float
