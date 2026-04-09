import logging
import uuid
from datetime import datetime, timedelta, timezone

from api.config import settings
from api.redis import redis_client
from api.schemas import UserRole
from api.services.audit_service import log_audit_event
from api.services.auth_service import create_registration_session
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Credential, RegistrationSession, User
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bootstrap", tags=["bootstrap"])

BOOTSTRAP_COMPLETED_KEY = "bootstrap:completed"
BOOTSTRAP_TOKEN_PREFIX = "bootstrap:token:"
BOOTSTRAP_RATELIMIT_PREFIX = "bootstrap:ratelimit:"
BOOTSTRAP_RATELIMIT_MAX = 5
BOOTSTRAP_RATELIMIT_WINDOW = 60


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{BOOTSTRAP_RATELIMIT_PREFIX}{client_ip}"
    redis_client.set(key, 0, ex=BOOTSTRAP_RATELIMIT_WINDOW, nx=True)
    count = int(redis_client.incr(key))
    if count > BOOTSTRAP_RATELIMIT_MAX:
        ttl = int(redis_client.ttl(key))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=Messages.BOOTSTRAP_RATE_LIMITED,
            headers={"Retry-After": str(max(ttl, 1))},
        )


def _bootstrap_initialized(db: Session) -> bool:
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    return operator is not None or admin is not None


def _ensure_bootstrap_allowed(db: Session) -> None:
    if not settings.bootstrap_enabled:
        logger.warning(Logs.BOOTSTRAP_DENIED_DISABLED)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=Messages.BOOTSTRAP_DISABLED,
        )

    if redis_client.get(BOOTSTRAP_COMPLETED_KEY):
        logger.warning(Logs.BOOTSTRAP_DENIED_ALREADY_COMPLETED)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.BOOTSTRAP_ALREADY_COMPLETED,
        )

    if _bootstrap_initialized(db):
        logger.warning(Logs.BOOTSTRAP_DENIED_ALREADY_INITIALIZED)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.BOOTSTRAP_ALREADY_INITIALIZED,
        )


def _validate_bootstrap_token(bootstrap_token: str | None) -> str:
    if bootstrap_token is None or bootstrap_token.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.BOOTSTRAP_TOKEN_REQUIRED,
        )

    token_key = f"{BOOTSTRAP_TOKEN_PREFIX}{bootstrap_token.strip()}"
    if not redis_client.get(token_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.BOOTSTRAP_TOKEN_INVALID,
        )

    return token_key


@router.get("/status")
def bootstrap_status(db: Session = Depends(get_db)):
    if not settings.bootstrap_enabled:
        return {"phase": "disabled"}
    if redis_client.get(BOOTSTRAP_COMPLETED_KEY):
        operator = (
            db.query(User)
            .filter(User.role.in_([UserRole.OPERATOR, UserRole.ADMIN]))
            .first()
        )
        if operator:
            has_credential = (
                db.query(Credential.id)
                .filter(Credential.user_id == operator.id)
                .first()
                is not None
            )
            if not has_credential:
                reg_session = RegistrationSession(
                    id=str(uuid.uuid4()),
                    user_id=operator.id,
                    created_at=datetime.now(timezone.utc),
                    expires_at=datetime.now(timezone.utc)
                    + timedelta(seconds=settings.registration_timeout),
                )
                db.add(reg_session)
                db.commit()
                reg_response = create_registration_session(reg_session)
                return {
                    "phase": "pending_registration",
                    "registration_url": reg_response.url,
                }
        return {"phase": "completed"}
    if _bootstrap_initialized(db):
        return {"phase": "completed"}
    return {"phase": "ready"}


@router.post("/operator")
def initialize_operator(
    request: Request,
    bootstrap_token: str | None = Header(default=None, alias="X-Bootstrap-Token"),
    db: Session = Depends(get_db),
):
    logger.info(Logs.BOOTSTRAP_ATTEMPT)
    _check_rate_limit(request)
    _ensure_bootstrap_allowed(db)
    token_key = _validate_bootstrap_token(bootstrap_token)
    log_audit_event(AuditEvents.BOOTSTRAP_ATTEMPT, None, None, {}, db)

    new_operator = User(
        id=str(uuid.uuid4()),
        role=UserRole.OPERATOR,
        full_name="Operator",
        email=f"operator@{settings.rp_id}",
    )

    try:
        db.add(new_operator)
        db.flush()
        db.refresh(new_operator)
        logger.info(Logs.OPERATOR_CREATED.format(user_id=new_operator.id))

        reg_session = RegistrationSession(
            id=str(uuid.uuid4()),
            user_id=new_operator.id,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.registration_timeout),
        )
        db.add(reg_session)
        log_audit_event(AuditEvents.BOOTSTRAP_COMPLETED, new_operator.id, None, {}, db)
        db.commit()

        redis_client.delete(token_key)
        redis_client.set(BOOTSTRAP_COMPLETED_KEY, "1")
        logger.info(Logs.BOOTSTRAP_COMPLETED)

        reg_response = create_registration_session(reg_session)
        return {"registration_url": reg_response.url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(Logs.OPERATOR_BOOTSTRAP_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.OPERATOR_BOOTSTRAP_FAILED,
        )
