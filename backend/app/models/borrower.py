from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Borrower(Base):
    """A borrower's credit profile, stored as the exact raw feature set the
    GMSC PD model expects (see financial-risk-analyst-ml inference.py input_fn).
    """

    __tablename__ = "borrowers"

    borrower_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))

    age: Mapped[int] = mapped_column(Integer)
    revolving_utilization_of_unsecured_lines: Mapped[float] = mapped_column(Float)
    number_of_time_30_59_days_past_due_not_worse: Mapped[int] = mapped_column(Integer)
    debt_ratio: Mapped[float] = mapped_column(Float)
    monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    number_of_open_credit_lines_and_loans: Mapped[int] = mapped_column(Integer)
    number_of_times_90_days_late: Mapped[int] = mapped_column(Integer)
    number_real_estate_loans_or_lines: Mapped[int] = mapped_column(Integer)
    number_of_time_60_89_days_past_due_not_worse: Mapped[int] = mapped_column(Integer)
    number_of_dependents: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    loans: Mapped[list["Loan"]] = relationship(back_populates="borrower")

    def to_pd_model_payload(self) -> dict:
        """Exact request shape the gmsc-pd-endpoint SageMaker endpoint expects."""
        return {
            "RevolvingUtilizationOfUnsecuredLines": self.revolving_utilization_of_unsecured_lines,
            "age": self.age,
            "NumberOfTime30-59DaysPastDueNotWorse": (
                self.number_of_time_30_59_days_past_due_not_worse
            ),
            "DebtRatio": self.debt_ratio,
            "MonthlyIncome": self.monthly_income,
            "NumberOfOpenCreditLinesAndLoans": self.number_of_open_credit_lines_and_loans,
            "NumberOfTimes90DaysLate": self.number_of_times_90_days_late,
            "NumberRealEstateLoansOrLines": self.number_real_estate_loans_or_lines,
            "NumberOfTime60-89DaysPastDueNotWorse": (
                self.number_of_time_60_89_days_past_due_not_worse
            ),
            "NumberOfDependents": self.number_of_dependents,
        }


class Loan(Base):
    __tablename__ = "loans"

    loan_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    borrower_id: Mapped[str] = mapped_column(
        ForeignKey("borrowers.borrower_id"), index=True
    )
    loan_type: Mapped[str] = mapped_column(String(50))

    # EAD (Exposure at Default) approximation for the MVP: EAD ~= outstanding_balance.
    outstanding_balance: Mapped[float] = mapped_column(Float)
    # LGD = 1 - recovery_rate.
    recovery_rate: Mapped[float] = mapped_column(Float, default=0.60)

    origination_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)

    borrower: Mapped["Borrower"] = relationship(back_populates="loans")
    payments: Mapped[list["Payment"]] = relationship(back_populates="loan")


class Payment(Base):
    __tablename__ = "payments"

    payment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loan_id: Mapped[str] = mapped_column(ForeignKey("loans.loan_id"))
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="paid")

    loan: Mapped["Loan"] = relationship(back_populates="payments")
