from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.engines.credit_risk import assess_borrower
from app.models.borrower import Borrower, Loan
from app.schemas.credit import CreditAssessmentResponse

router = APIRouter(prefix="/credit", tags=["credit"])


@router.get("/borrowers/{borrower_id}/assess", response_model=CreditAssessmentResponse)
def assess(borrower_id: str, explain: bool = False, db: Session = Depends(get_db)) -> CreditAssessmentResponse:
    borrower = db.get(Borrower, borrower_id)
    if borrower is None:
        raise HTTPException(status_code=404, detail=f"Borrower {borrower_id} not found")

    loan = db.scalars(
        select(Loan).where(Loan.borrower_id == borrower_id, Loan.status == "active").limit(1)
    ).first()

    result = assess_borrower(borrower, loan, explain=explain)
    return CreditAssessmentResponse(**result.__dict__)
