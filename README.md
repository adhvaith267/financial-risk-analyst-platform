# Financial Risk Analyst Platform

A full-stack application for assessing credit risk, portfolio market risk, and the impact of configurable stress scenarios. It provides a React interface, a FastAPI API, persisted assessment results, and an AI analyst endpoint that uses implemented risk tools to answer natural-language questions.

## Core functionality

### Credit risk assessment

For a selected borrower, the platform obtains probability of default (PD) from the configured Amazon SageMaker endpoint. It then calculates:

- **Loss given default (LGD):** `1 - recovery rate`
- **Exposure at default (EAD):** active-loan outstanding balance
- **Expected loss (EL):** `PD × LGD × EAD`

The response also includes the model status, version, configured decline threshold, and any risk drivers returned by the model.

### Market risk assessment

The market-risk engine applies current portfolio quantities to stored daily price history. It calculates portfolio value, daily and annualized volatility, historical VaR at 95% and 99%, parametric VaR at 95%, expected shortfall at 95%, maximum drawdown, position weights, a return-correlation matrix, and concentration through the Herfindahl–Hirschman Index (HHI).

It flags risk drivers when a position is at least 20% of the portfolio or when a pair of assets has return correlation of at least 0.70.

### Stress testing

Stress tests combine three configurable shocks:

- an equity-price shock applied to equity holdings;
- an interest-rate shock in basis points applied to bond holdings using modified duration; and
- a relative PD shock applied across the active loan book.

The result separates market and credit losses, reports combined loss, compares baseline and stressed portfolio value and total expected loss, and returns identified vulnerabilities.

### AI analyst

The `/agent/ask` endpoint runs a LangGraph ReAct agent with five tools: borrower lookup, portfolio lookup, credit-risk assessment, market-risk assessment, and stress-scenario execution. The agent selects relevant tools, receives their structured output, and returns an answer with the executed tool trace. Its prompt requires quantitative values in the response to come from tool results rather than being estimated by the model.

## How it works

```text
React web application
        |
        | /api requests
        v
FastAPI service
  |-- Credit risk engine ----> SageMaker PD endpoint
  |-- Market risk engine ----> PostgreSQL price and holding data
  |-- Stress-test engine ----> PostgreSQL loans, holdings, and prices
  |-- LangGraph agent -------> Bedrock model + the same risk tools
        |
        v
PostgreSQL stores borrowers, loans, portfolios, holdings, prices,
and persisted credit, market, and stress-test results.
```

The dashboard aggregates database counts, active-loan exposure, computed portfolio metrics, recent assessments, and frequent credit-risk drivers from saved results.

## Application areas

The React application exposes five areas:

- **Dashboard:** portfolio and loan KPIs, recent analyses, and recurring risk drivers.
- **Credit Risk:** borrower selection and credit-assessment results.
- **Market Risk:** portfolio metrics, composition, value history, correlations, and risk drivers.
- **Stress Testing:** scenario inputs and baseline-versus-stressed outcomes.
- **AI Analyst:** natural-language questions with an execution trace.

## API

The FastAPI service uses `/api` as its public application prefix.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/dashboard/summary` | Dashboard metrics and recent analyses |
| `GET` | `/api/credit/borrowers` | Available borrowers |
| `GET` | `/api/credit/borrowers/{borrower_id}/assess` | Credit-risk assessment; accepts optional `explain=true` |
| `GET` | `/api/market/portfolios` | Available portfolios |
| `GET` | `/api/market/portfolios/{portfolio_id}/risk` | Market-risk assessment |
| `POST` | `/api/stress/portfolios/{portfolio_id}/run` | Run a stress scenario |
| `POST` | `/api/agent/ask` | Ask the AI analyst a question |

## Data and persistence

The database schema includes borrowers, loans, payments, assets, portfolios, portfolio holdings, daily market prices, saved risk results, and saved stress-test results.

The included seed script loads a sample of borrower data from the configured S3 object, creates demo loans, and creates a demo portfolio. Its market-price history is generated synthetically for demonstration purposes.

## Running locally

1. Copy `backend/.env.example` to `backend/.env` and set the database and AWS integration values.
2. Start the API:

   ```bash
   cd backend
   uv sync
   uv run alembic upgrade head
   uv run uvicorn app.main:app --reload
   ```

3. In a second terminal, start the web application:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

Vite serves the frontend on port `5173` and proxies `/api` requests to the FastAPI service on port `8000`.

## Deployment

The repository contains deployment configuration for an Amazon Linux EC2 host. Nginx serves the built React application and reverse-proxies `/api/` requests to Uvicorn on `127.0.0.1:8000`; a systemd unit runs the API service. Shell scripts provision EC2, the application IAM role, and an RDS PostgreSQL instance, then configure the host and run Alembic migrations.

## Technology, AWS services, and tools

| Category | Used in this project |
| --- | --- |
| Frontend | React, React Router, Axios, Vite |
| Backend | Python, FastAPI, Uvicorn, Pydantic, SQLAlchemy |
| Data and analysis | PostgreSQL, Alembic, NumPy, pandas, SciPy |
| AI and orchestration | LangGraph, LangChain Core, LangChain AWS |
| AWS services | Amazon Bedrock, Amazon SageMaker Runtime, Amazon RDS for PostgreSQL, Amazon EC2, Amazon S3, IAM |
| Deployment and development tools | Nginx, systemd, uv, npm, AWS CLI, pytest, Ruff |
