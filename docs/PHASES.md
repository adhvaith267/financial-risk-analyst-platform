# Implementation phases

Tracks the roadmap from the architecture doc. Updated as work lands; not a
design doc, just a running checklist.

## Phase 0 — IAM
- [x] Scoped `fra-platform-dev` IAM user + `FRAPlatformDevPolicy`, `fra-dev` CLI profile

## Phase 1 — RDS PostgreSQL
- [x] Provisioned `fra-postgres-dev` (17.10, db.t4g.micro), schema migrated (9 tables)

## Phase 2 — Data ingestion
- [x] 30 real GMSC-sampled borrowers/loans + demo portfolio P001 (synthetic prices)

## Phase 3 — Credit Risk Engine
- [x] `app/engines/credit_risk.py`: PD via `gmsc-pd-endpoint`, LGD/EAD/EL, verified live

## Phase 4 — Market Risk Engine
- [x] `app/engines/market_risk.py`: volatility, historical/parametric VaR, ES,
      max drawdown, HHI/concentration
- [x] `GET /market/portfolios/{id}/risk`
- [x] Unit tests (pure `compute_market_risk`, no DB)
- [x] Verified live against RDS/P001 (vol 10.9% annualized, VaR95 $4,015,
      VaR99 $6,091, ES95 $5,224, max drawdown -20.3%, HHI 0.212)

## Phase 5 — Stress Testing Engine
- [x] `app/engines/stress.py`: equity/rate/default shocks -> market loss + credit loss -> combined
      (bond rate-shock uses a documented 17yr effective-duration assumption;
      credit shock is firm-wide across active loans, not portfolio-scoped -
      no FK between portfolios and loans in this schema)
- [x] `POST /stress/portfolios/{id}/run`, persists to `stress_results`
- [x] Unit tests (5, pure shock functions)
- [x] Verified live: recession scenario on P001 -> market loss $66,455 +
      credit loss $11,169 (batched SageMaker call across all 30 active
      loans, one round trip) = combined $77,624

## Phase 6 — LangGraph agent + Bedrock
- [x] Tool wrappers around the 3 engines + DB lookups (`app/agent/tools.py`):
      get_borrower, get_portfolio, assess_credit_risk, assess_market_risk,
      run_stress_scenario - each opens its own short-lived DB session
      (LangGraph runs tool calls concurrently across threads; a shared
      Session isn't thread-safe)
- [x] LangGraph ReAct agent (`app/agent/graph.py`) wiring tool selection ->
      engine calls -> Bedrock synthesis, with a system prompt that forbids
      the model from computing PD/LGD/VaR/etc. itself
- [x] `POST /agent/ask`, verified live over HTTP for both single-tool
      (credit) and multi-tool (market + stress) questions
- [x] Model: **Bedrock access audit** - Claude Sonnet/Opus 4.6 and 5 are
      blocked account-wide by an AWS Marketplace `INVALID_PAYMENT_INSTRUMENT`
      error (confirmed via Converse *and* InvokeModel, root and fra-dev,
      unaffected by accepting the model agreement - needs a payment method
      fix in Billing Console, user's call to make). Swept the full model
      catalog; landed on **moonshot.kimi-k2-thinking** (natively hosted, no
      billing blocker, built for agentic tool-use). Config is one line
      (`bedrock_model_id` in `app/core/config.py`) to swap later.
- [x] Fixed a `<think>...</think>` reasoning-leak bug in the final answer
      (Kimi inlines chain-of-thought as literal tags sometimes without a
      closing tag, and Converse content can be a string or a list of
      blocks depending on the model) - `_extract_text()` handles both

## Phase 7 — RAG (S3 + Bedrock Knowledge Bases)
- [ ] Needs an AWS decision on vector store backend (OpenSearch Serverless has
      an hourly cost even idle) - will ask before provisioning
- [ ] Seed methodology/assumptions docs, ingest into KB
- [ ] Wire retrieval into the agent

## Phase 8 — React frontend
- [ ] Dashboard, Credit/Market/Stress views, AI Analyst chat

## Phase 9 — AWS deployment
- [ ] ECS/Fargate for backend, Amplify for frontend - needs deployment
      architecture decisions, will ask before provisioning

## Phase 10 — Security + audit + testing pass
- [ ] Revert RDS to private once ECS is in place
- [ ] Review IAM policy scope end to end
