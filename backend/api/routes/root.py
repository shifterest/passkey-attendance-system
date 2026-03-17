import logging

from api.redis import redis_client
from database import get_db
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/", tags=["root"])


@router.get("/")
def read_root():
    return {"tantan": "cutie"}


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    checks: dict[str, str] = {}
    healthy = True

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.error("Health check: database probe failed: %s", e)
        checks["database"] = "error"
        healthy = False

    try:
        redis_client.ping()
        checks["redis"] = "ok"
    except Exception as e:
        logger.error("Health check: redis probe failed: %s", e)
        checks["redis"] = "error"
        healthy = False

    payload = {"status": "healthy" if healthy else "unhealthy", **checks}
    status_code = 200 if healthy else 503
    return JSONResponse(content=payload, status_code=status_code)
