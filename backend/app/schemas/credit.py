from pydantic import BaseModel


class CreditAssessmentResponse(BaseModel):
    borrower_id: str
    pd: float
    lgd: float
    ead: float
    expected_loss: float
    status: str
    model_version: str
    risk_drivers: list[str]
