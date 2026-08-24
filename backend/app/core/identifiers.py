import re

from app.core.errors import InvalidInputError

IDENTIFIER_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9_-]{0,19}$")


def normalize_identifier(value: str, field_name: str) -> str:
    identifier = value.strip().upper()
    if not identifier or not IDENTIFIER_PATTERN.fullmatch(identifier):
        raise InvalidInputError(
            f"{field_name} must contain 1-20 letters, numbers, underscores, or hyphens."
        )
    return identifier
