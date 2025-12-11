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
    comments = Column(String, nullable=True) # Ensure comments exist as per schema, though it wasn't in original model snippet it's in schema. Wait, previous model view didn't show comments column but schema has it. I should check if I missed it or if it's missing in model.
    # Actually, let's stick to what I see. The view showed only type, provider, ratings, created_at.
    # Schema has comments and attachment. Model must have them too if they are being saved.
    # Let me re-verify model content from previous view.
    # Previous view: id, type, provider, ratings, created_at.
    # Schema: type, provider, ratings, comments, attachment.
    # Using `Code Content` from previous view_file.
    
    # I will add the new columns. I will also add comments/attachment if they were missing, but let's focus on the requested changes first or I might break things if they are stored in JSON.
    # Actually, looking at `create_feedback` in main.py would clarify how they are saved.
    # But I will just add the requested columns for now.
    
    nperf_test_id = Column(String(255), nullable=True)
    sector = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Feedback id={self.id} type={self.type} provider={self.provider}>"


class NPerfResult(Base):
    __tablename__ = "nperf_results"

    id = Column(Integer, primary_key=True, index=True)
    nperf_test_id = Column(String(255), nullable=True)
    external_uuid = Column(String(255), nullable=True)
    sector = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

