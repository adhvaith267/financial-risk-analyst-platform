from dataclasses import dataclass

from app.core.config import get_settings
from app.models.borrower import Borrower, Loan
from app.services.sagemaker_client import get_pd_model_client


@dataclass
class CreditAssessment:
    borrower_id: str
    pd: float
    lgd: float
    ead: float
    expected_loss: float
    status: str
    model_version: str
    risk_drivers: list[str]
    decline_threshold: float


def assess_borrower(
    borrower: Borrower, loan: Loan | None = None, explain: bool = False
) -> CreditAssessment:
    """PD comes from the SageMaker model. LGD/EAD/EL are deterministic financial
    logic layered on top - the model never predicts a dollar amount directly.
    """
    settings = get_settings()

    prediction = get_pd_model_client().predict(borrower.to_pd_model_payload(), explain=explain)
    pd_value = prediction["pd"]

    recovery_rate = loan.recovery_rate if loan is not None else settings.default_recovery_rate
    lgd = 1 - recovery_rate

    ead = loan.outstanding_balance if loan is not None else 0.0

    expected_loss = pd_value * lgd * ead

    return CreditAssessment(
        borrower_id=borrower.borrower_id,
        pd=pd_value,
        lgd=lgd,
        ead=ead,
        expected_loss=expected_loss,
        status=prediction.get("status", "UNKNOWN"),
        model_version=prediction.get("model_version", "unknown"),
        risk_drivers=prediction.get("risk_drivers", []),
        decline_threshold=settings.credit_decline_threshold,
    )
