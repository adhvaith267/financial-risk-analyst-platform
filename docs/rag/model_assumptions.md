# Model & Data Assumptions

## Separation of responsibilities

This platform strictly separates prediction from calculation from
orchestration: SageMaker predicts Probability of Default; deterministic
financial engines (Python, no ML) compute LGD, EAD, Expected Loss,
volatility, VaR, Expected Shortfall, drawdown, concentration, and stress
losses; the LangGraph agent on Amazon Bedrock decides which tools to call
and writes the natural-language explanation. The agent is instructed to
never compute a risk number itself - every figure in an AI Assessment
traces back to a specific tool call.

## Demo data provenance

- **Borrowers/loans** (B1001-B1030): sampled directly from the real GMSC
  ("Give Me Some Credit") training dataset used to train the PD model
  (fixed random seed for reproducibility). These are real anonymized
  credit-bureau attributes, not synthetic data. Loan `outstanding_balance`
  and `recovery_rate` are a simple heuristic layered on top (income x debt
  ratio, mortgage vs. personal loan type), and are clearly synthetic.
- **Portfolio P001 market prices**: synthetic, generated via geometric
  Brownian motion with a fixed random seed - a placeholder pending the
  real-world data phase (FRED for macro data, a market data API for live
  prices). No live market data is used yet as of this phase of the build.

## PD model

Production model is LightGBM (benchmarked against XGBoost and a Logistic
Regression baseline), calibrated with isotonic regression (Brier score
improved from 0.1421 raw to 0.0487 calibrated, a ~65.7% reduction).
Trained on the GMSC dataset (150,000 samples, ~6.68% positive/default
rate), using class-imbalance weighting (scale_pos_weight ~= 13.96) and
Optuna-tuned hyperparameters (50 trials). The `model_version` field
returned by the endpoint is an operator-set tag from an environment
variable, not automatically derived from the model artifact or algorithm
family - it should be treated as an opaque version label.

## Region and infrastructure

All AWS resources for this platform run in ap-south-1 (Mumbai). The
Bedrock agent currently uses a natively-hosted model (not a
Marketplace-fulfilled Anthropic Claude model) due to an account-level AWS
Marketplace payment configuration issue unrelated to model capability.
