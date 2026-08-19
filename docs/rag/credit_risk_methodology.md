# Credit Risk Methodology

## Expected Loss

Expected Loss (EL) is calculated as:

EL = PD x LGD x EAD

- **PD (Probability of Default)** comes from the GMSC gradient-boosting model
  served by the `gmsc-pd-endpoint` SageMaker endpoint. It is a calibrated
  (isotonic regression) probability that a borrower experiences serious
  delinquency (90+ days past due) within two years. The model is never
  approximated or re-implemented outside of SageMaker - every PD figure in
  this platform is a real model inference.
- **LGD (Loss Given Default)** = 1 - Recovery Rate. The default assumption
  is a 60% recovery rate (40% LGD) unless a loan specifies its own
  `recovery_rate`. Demo data uses 65% recovery for mortgage-type loans
  (real estate collateral) and 55% for unsecured personal loans - this is a
  documented simplification, not a separately modeled recovery process.
- **EAD (Exposure at Default)** is approximated as the loan's current
  outstanding balance. For revolving credit, a more precise EAD would use
  EAD = Drawn + CCF x Undrawn, but this platform's MVP scope uses the
  simpler balance-based approximation.

## Risk drivers / explainability

Local SHAP values (from the trained LightGBM/XGBoost model, computed inside
the SageMaker endpoint) identify which borrower attributes push a given
borrower's PD up or down. The most common global risk drivers for this
model, in order of importance, are: revolving utilization of unsecured
lines, total delinquency count, age, presence of any delinquency, and
number of open credit lines. A borrower flagged with "missing income" as a
risk driver reflects a genuine gap in the input data (the model treats a
missing `MonthlyIncome` field as informative), not a data pipeline bug.

## Credit decision threshold

The SageMaker endpoint applies a default decision threshold of PD >= 10%
to mark a borrower's status as DECLINED versus APPROVED. This threshold is
configurable via the endpoint's `RISK_THRESHOLD` environment variable and
is a business policy choice, not a property of the model itself.
