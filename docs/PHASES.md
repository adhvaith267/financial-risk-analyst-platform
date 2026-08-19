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
- [ ] Tool wrappers around the 3 engines + DB lookups
- [ ] LangGraph graph wiring tool selection -> engine calls -> Bedrock synthesis
- [ ] `POST /agent/ask`

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
