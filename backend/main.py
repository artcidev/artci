import os
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from .db import get_db, Base, engine
from . import models, schemas

# Create tables on startup (simple bootstrap; for production prefer migrations)
try:
    if os.getenv("RESET_DB_ON_STARTUP", "").lower() == "true":
        print("WARNING: RESET_DB_ON_STARTUP is true. Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        
    Base.metadata.create_all(bind=engine)
except Exception as e:
    # Ignorer l'erreur si c'est une 'UniqueViolation' due à une race condition entre workers
    print(f"Schema creation warning (safe to ignore if multiple workers): {e}")

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
    # Extract ratings and meta if needed, but since we have new columns, let's just map them.
    # The 'ratings' column expects the list of dicts.
    # We want to pass everything that matches the model.
    
    # We can handle the ratings/meta processing if still needed for the 'ratings' column structure.
    # The original code appended meta to ratings list. We should preserve that behavior if it's important for analytics.
    ratings = list(data.get("ratings") or [])
    meta = {"comments": data.get("comments") or "", "attachment": data.get("attachment") or ""}
    if meta["comments"] or meta["attachment"]:
        ratings.append({"_meta": meta})
    
    # Update data['ratings'] with the modified list
    data['ratings'] = ratings
    
    # Now create the object using unpacking. 
    # Warning: payload.model_dump() includes 'comments'/'attachment' which are NOT in models.Feedback (unless I added them, which I didn't verify if I should have). 
    # Ah, I added 'comments' in my previous edit to models.py? 
    # Let me check my thought process... I said "I will also add comments column". 
    # Wait, in the actual tool call for models.py (Step 161), I DID add `comments = Column(String, nullable=True)`.
    # So 'comments' IS in the model now. 
    # 'attachment' was NOT added to the model in Step 161.
    # So if I pass 'attachment' to Feedback(**data), it will crash if using **data directly.
    
    # Safest bet: Explicit mapping for safety + preservation of original logic.
    fb = models.Feedback(
        type=data["type"],
        provider=data["provider"],
        ratings=ratings,  # stored as JSON/JSONB
        comments=data.get("comments"), # Now exists in model
        nperf_test_id=data.get("nperf_test_id"),
        sector=data.get("sector")
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb # Return the db object, Pydantic handles serialization


@app.post("/api/nperf/results", response_model=schemas.NPerfResultOut)
def create_nperf_result(payload: schemas.NPerfResultIn, db: Session = Depends(get_db)):
    db_obj = models.NPerfResult(
        nperf_test_id=payload.nperf_test_id,
        external_uuid=payload.external_uuid,
        sector=payload.sector
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@app.get("/api/nperf/results", response_model=Dict[str, Any])
def list_nperf_results(
    page: int = 1,
    limit: int = 50,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.NPerfResult)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(models.NPerfResult.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            # inclusive end date
            query = query.filter(models.NPerfResult.created_at <= end_dt + timedelta(days=1))
        except ValueError:
            pass

    total = query.count()
    
    # Pagination
    offset = (page - 1) * limit
    results = query.order_by(models.NPerfResult.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "items": [schemas.NPerfResultOut.from_orm(r) for r in results],
        "total": total,
        "page": page,
        "limit": limit
    }


from sqlalchemy import text


@app.post("/api/admin/update-schema")
def update_schema(db: Session = Depends(get_db)):
    """Temporary endpoint to manually update the database schema for feedbacks table"""
    try:
        # PostgreSQL syntax to add columns if not exists
        # Note: SQLite does not support IF NOT EXISTS in ADD COLUMN in older versions, 
        # but modern Postgres does.
        # We'll use a brute-force approach with try/except blocks for broad compatibility or specific syntax.
        
        # Adding nperf_test_id
        try:
            db.execute(text("ALTER TABLE feedbacks ADD COLUMN nperf_test_id VARCHAR(255)"))
        except Exception as e:
            # Likely already exists
            print(f"Column nperf_test_id might already exist: {e}")
            db.rollback()

        # Adding sector
        try:
            db.execute(text("ALTER TABLE feedbacks ADD COLUMN sector VARCHAR(255)"))
        except Exception as e:
            print(f"Column sector might already exist: {e}")
            db.rollback()

        # Adding comments
        try:
            db.execute(text("ALTER TABLE feedbacks ADD COLUMN comments VARCHAR"))
        except Exception as e:
             print(f"Column comments might already exist: {e}")
             db.rollback()
             
        db.commit()
        return {"status": "Schema update attempted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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


# -----------------------------
# Analytics endpoints
# -----------------------------

def _iter_rating_items(ratings: List[Dict[str, Any]]):
    """Yield tuples (label, rating_value_as_int) from stored ratings array."""
    for entry in ratings or []:
        if not isinstance(entry, dict):
            continue
        # each entry like {"crit-1": {"label": ..., "sublabel": ..., "rating": "2"}}
        for _key, val in entry.items():
            try:
                label = (val.get("label") or "").strip()
                rating_str = (val.get("rating") or "").strip()
                if not label or rating_str not in {"1", "2", "3", "4"}:
                    continue
                yield label, int(rating_str)
            except Exception:
                continue


def _filter_rows(rows: List[models.Feedback], start_date: Optional[str], end_date: Optional[str],
                 type_filter: Optional[str], provider_filter: Optional[str]) -> List[models.Feedback]:
    """Filter feedback rows according to optional query params.
    Dates should be in YYYY-MM-DD.
    """
    def parse_date(s: Optional[str]) -> Optional[datetime]:
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None

    start_dt = parse_date(start_date)
    end_dt = parse_date(end_date)

    out: List[models.Feedback] = []
    for r in rows:
        if type_filter and r.type != type_filter:
            continue
        if provider_filter and r.provider != provider_filter:
            continue
        ts = r.created_at
        if start_dt and ts and ts < start_dt:
            continue
        if end_dt and ts and ts > end_dt + timedelta(days=1):  # inclusive end date
            continue
        out.append(r)
    return out


@app.get("/api/analytics/summary")
def analytics_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,  # fixe/mobile
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    rows = db.query(models.Feedback).all()
    rows = _filter_rows(rows, start_date, end_date, type, provider)

    total_fb = len(rows)
    by_type = Counter([r.type for r in rows])
    by_provider = Counter([r.provider for r in rows])

    # rating distribution across all selected criteria in all feedbacks
    dist = Counter()
    for r in rows:
        for _label, rating in _iter_rating_items(r.ratings):
            dist[str(rating)] += 1

    return {
        "total_feedback": total_fb,
        "by_type": dict(by_type),
        "by_provider": dict(by_provider),
        "rating_distribution": {k: dist.get(k, 0) for k in ["1", "2", "3", "4"]},
    }


@app.get("/api/analytics/criteria")
def analytics_criteria(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    rows = db.query(models.Feedback).all()
    rows = _filter_rows(rows, start_date, end_date, type, provider)
    sums = defaultdict(int)
    counts = defaultdict(int)
    dist = defaultdict(lambda: Counter())

    for r in rows:
        for label, rating in _iter_rating_items(r.ratings):
            sums[label] += rating
            counts[label] += 1
            dist[label][str(rating)] += 1

    result = []
    for label in sorted(counts.keys()):
        c = counts[label]
        s = sums[label]
        avg = (s / c) if c else 0.0
        result.append({
            "label": label,
            "count": c,
            "avg": round(avg, 2),
            "distribution": {k: dist[label].get(k, 0) for k in ["1", "2", "3", "4"]},
        })
    return result


@app.get("/api/analytics/time_series")
def analytics_time_series(
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    # gather rows in the last N days and bucket by date (YYYY-MM-DD)
    now = datetime.utcnow()
    since = now - timedelta(days=max(1, days))
    rows = db.query(models.Feedback).all()
    rows = _filter_rows(rows, start_date, end_date, type, provider)

    buckets = Counter()
    for r in rows:
        ts = r.created_at
        if ts is None:
            continue
        # normalize to date string in UTC
        try:
            d = ts.date() if hasattr(ts, 'date') else datetime.fromisoformat(str(ts)).date()
        except Exception:
            continue
        if d >= since.date():
            buckets[str(d)] += 1

    # ensure all days present
    out = []
    for i in range(max(1, days)):
        d = (since + timedelta(days=i+1)).date()  # up to today roughly
        key = str(d)
        out.append({"date": key, "count": buckets.get(key, 0)})
    return out


@app.get("/api/analytics/heatmap")
def analytics_heatmap(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, int]]:
    """Return counts bucketed by weekday (0=Mon) and hour (0-23)."""
    rows = db.query(models.Feedback).all()
    rows = _filter_rows(rows, start_date, end_date, type, provider)
    grid = Counter()  # key=(weekday, hour)
    for r in rows:
        ts = r.created_at
        if not ts:
            continue
        try:
            wd = ts.weekday()  # 0..6, Monday=0
            hr = ts.hour
            grid[(wd, hr)] += 1
        except Exception:
            continue
    out: List[Dict[str, int]] = []
    for wd in range(7):
        for hr in range(24):
            out.append({"weekday": wd, "hour": hr, "count": grid.get((wd, hr), 0)})
    return out


@app.get("/api/analytics/criteria_over_time")
def analytics_criteria_over_time(
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Average rating per criterion per day for the given window.
    Returns a flat list of rows: {date, label, avg}
    """
    now = datetime.utcnow()
    since = now - timedelta(days=max(1, days))
    rows = db.query(models.Feedback).all()
    rows = _filter_rows(rows, start_date, end_date, type, provider)

    # Aggregate sums and counts by date, label
    sums: Dict[tuple, int] = defaultdict(int)
    counts: Dict[tuple, int] = defaultdict(int)
    for r in rows:
        ts = r.created_at
        if not ts:
            continue
        try:
            d = ts.date() if hasattr(ts, 'date') else datetime.fromisoformat(str(ts)).date()
        except Exception:
            continue
        if d < since.date():
            continue
        for label, rating in _iter_rating_items(r.ratings):
            key = (str(d), label)
            sums[key] += rating
            counts[key] += 1

    # Build output for each day in window and every label seen
    labels = sorted({lbl for (_d, lbl) in counts.keys()})
    out: List[Dict[str, Any]] = []
    for i in range(max(1, days)):
        d = (since + timedelta(days=i+1)).date()
        d_str = str(d)
        for lbl in labels:
            c = counts.get((d_str, lbl), 0)
            s = sums.get((d_str, lbl), 0)
            avg = (s / c) if c else 0.0
            out.append({"date": d_str, "label": lbl, "avg": round(avg, 2)})
    return out


# Serve the built/static UI from / (source directory)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(BASE_DIR, "source")
STATIC_DIR = os.path.abspath(STATIC_DIR)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve favicon from /images even when browser requests /favicon.ico at root
FAVICON_PATH = os.path.join(STATIC_DIR, "images", "favicon.ico")

@app.get("/favicon.ico")
def favicon():
    if os.path.exists(FAVICON_PATH):
        return FileResponse(FAVICON_PATH)
    raise HTTPException(status_code=404, detail="favicon not found")

# Register explicit pages BEFORE mounting the catch-all static route
# (so /dashboard is not shadowed by the StaticFiles mount at "/").
@app.get("/index.html")
def index_html():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/dashboard")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> Dict[str, str]:
    # Save to uploads directory with a timestamped name
    orig = file.filename or "upload.bin"
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    safe_name = "".join(c for c in orig if c.isalnum() or c in (".", "-", "_")) or "file"
    name = f"{ts}_{safe_name}"
    path = os.path.join(UPLOAD_DIR, name)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    return {"filename": name, "url": f"/uploads/{name}"}

@app.get("/a-propos-android")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "a-propos-android.html"))

@app.get("/a-propos-huawei")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "a-propos-huawei.html"))

@app.get("/a-propos-ios")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "a-propos-ios.html"))

@app.get("/cgu-eula")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "cgu-eula.html"))

@app.get("/politique-confidentialite")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "politique-confidentialite.html"))

@app.get("/politique-cookies")
def dashboard_html():
    return FileResponse(os.path.join(STATIC_DIR, "politique-cookies.html"))

@app.get("/ci-perf")
def ci_perf_page():
    response = FileResponse(os.path.join(STATIC_DIR, "ci-perf.html"))
    response.headers["X-Frame-Options"] = "ALLOWALL"
    return response

# Finally, mount static catch-all at /
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
