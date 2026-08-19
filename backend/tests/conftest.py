import os

# Settings requires DB credentials even for tests that never touch the DB
# (Borrower/Loan are plain SQLAlchemy models instantiated in-memory here).
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PASSWORD", "test")
