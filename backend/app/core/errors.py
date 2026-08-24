from typing import Any


class ApplicationError(Exception):
    """A safe, client-facing application error."""

    status_code = 500
    code = "application_error"

    def __init__(self, detail: str, *, context: dict[str, Any] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.context = context or {}


class InvalidInputError(ApplicationError):
    status_code = 400
    code = "invalid_input"


class ResourceNotFoundError(ApplicationError):
    status_code = 404
    code = "not_found"


class PortfolioDataUnavailableError(ResourceNotFoundError):
    code = "portfolio_data_unavailable"


class DependencyUnavailableError(ApplicationError):
    status_code = 503
    code = "dependency_unavailable"


class DatabaseUnavailableError(DependencyUnavailableError):
    code = "database_unavailable"


class AgentUnavailableError(DependencyUnavailableError):
    code = "agent_unavailable"


class AuthenticationRequiredError(ApplicationError):
    status_code = 401
    code = "authentication_required"


class AuthorizationDeniedError(ApplicationError):
    status_code = 403
    code = "authorization_denied"
