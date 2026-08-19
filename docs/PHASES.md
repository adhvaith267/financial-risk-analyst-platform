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

## Phase 7 — RAG
- [x] AWS decision made: skipped managed Bedrock Knowledge Bases (its
      vector store backends - OpenSearch Serverless, Aurora PGv2, etc -
      all mean a new billed resource with a real cost floor even idle).
      Self-built RAG instead: pgvector extension enabled on the existing
      free-tier RDS instance, near-zero incremental cost.
- [x] 4 methodology docs written (`docs/rag/*.md`, grounded in what's
      actually implemented, not generic filler) covering credit risk
      (EL/PD/LGD/EAD), market risk (VaR/ES/vol/drawdown/concentration),
      stress testing methodology, and model/data assumptions - synced to
      S3 via `infra/scripts/04_upload_rag_docs.sh`
- [x] `backend/scripts/ingest_rag_docs.py`: section-level chunking (17
      chunks from 4 docs), embedded via `amazon.titan-embed-text-v2:0`
      (1024-dim, natively hosted, no Marketplace issue), upserted into a
      new `methodology_chunks` table (idempotent per source file)
- [x] `app/engines/retrieval.py`: cosine-distance search via pgvector's
      `<=>` operator; verified live - top hit for "How is expected
      shortfall calculated?" was the correct ES section (distance 0.40)
- [x] Wired as agent tool `search_risk_methodology`; verified live that
      the agent grounds methodology answers in retrieved passages rather
      than answering from the model's own training data

## Phase 8 — React frontend
- [x] Vite + React (JS, no TypeScript/Next.js, per the architecture doc's
      explicit stance) + react-router-dom + axios. Scaffolded by hand -
      Node 18.19.1 in this environment is too old for the current
      `create-vite` CLI (needs Node 20.19+/22.12+), so wrote package.json/
      vite.config.js/index.html directly with Node-18-compatible versions.
- [x] Dashboard, Credit Risk, Market Risk, Stress Testing, AI Analyst
      (chat) pages - each calls its corresponding backend endpoint
- [x] CORS enabled on FastAPI for the Vite dev origin
- [x] `npm run build` succeeds cleanly; verified via curl that all SPA
      routes serve 200 and CORS preflight/actual cross-origin requests
      succeed end-to-end
- [ ] **Not visually/interactively verified in an actual browser** - no
      browser automation tool was available this session (user declined
      the Chrome extension). Structural verification only; recommend a
      manual click-through (`cd frontend && npm run dev`, backend running
      separately) before treating this phase as fully done.

## Phase 9 — AWS deployment
- [ ] ECS/Fargate for backend, Amplify for frontend - needs deployment
      architecture decisions, will ask before provisioning

## Phase 10 — Security + audit + testing pass
- [ ] Revert RDS to private once ECS is in place
- [ ] Review IAM policy scope end to end
