import os
from typing import List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from .db import get_db, Base, engine
from . import models, schemas

# Create tables on startup (simple bootstrap; for production prefer migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ARTCI Feedback API")

# If you plan to serve the UI from the same app, CORS can be strict.
# If UI may be served from another origin, adjust origins below.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/feedback", response_model=schemas.FeedbackOut)
def create_feedback(payload: schemas.FeedbackIn, db: Session = Depends(get_db)):
    data = payload.model_dump()  # ensure primitive types for JSON storage
    fb = models.Feedback(
        type=data["type"],
        provider=data["provider"],
        ratings=data["ratings"],  # stored as JSON/JSONB
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return schemas.FeedbackOut.from_orm(fb)


@app.get("/api/feedback", response_model=List[schemas.FeedbackOut])
def list_feedback(limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).limit(limit)
    return [schemas.FeedbackOut.from_orm(i) for i in q.all()]


@app.get("/api/feedback/{feedback_id}", response_model=schemas.FeedbackOut)
def get_feedback(feedback_id: int, db: Session = Depends(get_db)):
    fb = db.get(models.Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return schemas.FeedbackOut.from_orm(fb)


# Serve the built/static UI from / (source directory)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "source")
STATIC_DIR = os.path.abspath(STATIC_DIR)

# API routes are registered above; now mount static catch-all at /
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

# Optional explicit index route (StaticFiles with html=True already serves index.html)
@app.get("/index.html")
def index_html():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
