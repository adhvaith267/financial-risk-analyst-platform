from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.identifiers import normalize_identifier
from app.engines.stress import StressScenario, run_stress_test
from app.models.risk import StressResult as StressResultModel
from app.schemas.stress import StressResultResponse, StressScenarioRequest

router = APIRouter(prefix="/stress", tags=["stress"])


@router.post("/portfolios/{portfolio_id}/run", response_model=StressResultResponse)
def run(
    portfolio_id: str, request: StressScenarioRequest, db: Session = Depends(get_db)
) -> StressResultResponse:
    portfolio_id = normalize_identifier(portfolio_id, "portfolio_id")
    scenario = StressScenario(
        name=request.scenario_name,
        equity_shock=request.equity_shock,
        rate_shock_bps=request.rate_shock_bps,
        default_shock=request.default_shock,
    )
    result = run_stress_test(db, portfolio_id, scenario)

    db.add(
        StressResultModel(
            portfolio_id=portfolio_id,
            scenario_name=scenario.name,
            shocks={
                "equity_shock": scenario.equity_shock,
                "rate_shock_bps": scenario.rate_shock_bps,
                "default_shock": scenario.default_shock,
            },
            market_loss=result.market_loss,
            credit_loss=result.credit_loss,
            combined_loss=result.combined_loss,
        )
    )
    db.commit()

    return StressResultResponse(
        portfolio_id=portfolio_id,
        scenario_name=scenario.name,
        equity_shock=scenario.equity_shock,
        rate_shock_bps=scenario.rate_shock_bps,
        default_shock=scenario.default_shock,
        market_loss=result.market_loss,
        credit_loss=result.credit_loss,
        combined_loss=result.combined_loss,
        baseline_portfolio_value=result.baseline_portfolio_value,
        stressed_portfolio_value=result.stressed_portfolio_value,
        baseline_total_expected_loss=result.baseline_total_expected_loss,
        stressed_total_expected_loss=result.stressed_total_expected_loss,
        vulnerabilities=result.vulnerabilities,
    )
