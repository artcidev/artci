# syntax=docker/dockerfile:1

# Build a small, production-ready image for FastAPI backend serving the static frontend
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    WORKERS=2

# Install OS packages (curl for health checks/logs; and libpq for psycopg2-binary compatibility)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl \
       libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies separately for better caching
COPY requirements.txt ./
RUN pip install --upgrade pip \
 && pip install -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY source/ ./source/
COPY README.md ./README.md

# Expose port
EXPOSE 8000

# Default to SQLite unless DATABASE_URL is provided at runtime
ENV DATABASE_URL=sqlite:///./app.db

# Start the server (allow overriding PORT/WORKERS)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2}"]
