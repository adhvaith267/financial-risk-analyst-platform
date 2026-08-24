from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import ResourceNotFoundError
from app.core.identifiers import normalize_identifier
from app.engines.credit_risk import assess_borrower
from app.models.borrower import Borrower, Loan
from app.models.risk import RiskResult
from app.schemas.credit import (
    BorrowerProfile,
    BorrowerSummary,
    CreditAssessmentResponse,
)

router = APIRouter(prefix="/credit", tags=["credit"])


@router.get("/borrowers", response_model=list[BorrowerSummary])
def list_borrowers(db: Session = Depends(get_db)) -> list[BorrowerSummary]:
    borrowers = db.scalars(select(Borrower).order_by(Borrower.borrower_id)).all()
    active_loan_borrower_ids = set(
        db.scalars(select(Loan.borrower_id).where(Loan.status == "active"))
    )
    return [
        BorrowerSummary(
            borrower_id=b.borrower_id,
            name=b.name,
            has_active_loan=b.borrower_id in active_loan_borrower_ids,
        )
        for b in borrowers
    ]


@router.get("/borrowers/{borrower_id}/assess", response_model=CreditAssessmentResponse)
def assess(
    borrower_id: str, explain: bool = False, db: Session = Depends(get_db)
) -> CreditAssessmentResponse:
    borrower_id = normalize_identifier(borrower_id, "borrower_id")
    borrower = db.get(Borrower, borrower_id)
    if borrower is None:
        raise ResourceNotFoundError(f"Borrower {borrower_id} not found")

    loan = db.scalars(
        select(Loan).where(Loan.borrower_id == borrower_id, Loan.status == "active").limit(1)
    ).first()

    result = assess_borrower(borrower, loan, explain=explain)

    db.add(
        RiskResult(
            entity_type="borrower",
            entity_id=borrower_id,
            risk_type="credit",
            payload={
                "pd": result.pd,
                "lgd": result.lgd,
                "ead": result.ead,
                "expected_loss": result.expected_loss,
                "status": result.status,
                "risk_drivers": result.risk_drivers,
            },
        )
    )
    db.commit()

    total_delinquencies = (
        borrower.number_of_time_30_59_days_past_due_not_worse
        + borrower.number_of_time_60_89_days_past_due_not_worse
        + borrower.number_of_times_90_days_late
    )
    profile = BorrowerProfile(
        borrower_id=borrower.borrower_id,
        name=borrower.name,
        age=borrower.age,
        monthly_income=borrower.monthly_income,
        revolving_utilization=borrower.revolving_utilization_of_unsecured_lines,
        debt_ratio=borrower.debt_ratio,
        total_delinquencies=total_delinquencies,
        outstanding_balance=loan.outstanding_balance if loan else None,
        loan_type=loan.loan_type if loan else None,
    )

    return CreditAssessmentResponse(borrower=profile, **result.__dict__)
