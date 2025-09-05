from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.types import JSON as SAJSON
from sqlalchemy.dialects.postgresql import JSONB

from .db import Base, engine

# Use JSONB on Postgres, fallback to generic JSON on others (e.g., SQLite)
try:
    backend = engine.url.get_backend_name()
except Exception:
    backend = ""

JSONType = JSONB if backend == "postgresql" else SAJSON


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)
    provider = Column(String(255), nullable=False)
    ratings = Column(JSONType, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Feedback id={self.id} type={self.type} provider={self.provider}>"
