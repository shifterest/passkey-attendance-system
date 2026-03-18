import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from api.config import settings
from api.redis import redis_client
from api.schemas import PlayIntegrityVouchRequest
from api.services.integrity_service import (
    store_vouch,
    verify_integrity_token,
)
from api.services.session_service import require_role
from api.strings import Logs, Messages
from database import Credential, User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

PI_VOUCH_DAILY_COUNT_PREFIX = "pi_vouch_daily_count:"
PI_MAX_DAILY_VOUCHES = 3
PI_REQUIRED_VERDICT = "MEETS_DEVICE_INTEGRITY"


def _seconds_until_midnight() -> int:
    tz = ZoneInfo(settings.server_timezone)
    now = datetime.now(tz)
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(int((next_midnight - now).total_seconds()), 1)


def _today_date_str() -> str:
    return datetime.now(ZoneInfo(settings.server_timezone)).date().isoformat()


@router.post("/play-integrity/vouch")
def play_integrity_vouch(
    body: PlayIntegrityVouchRequest,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    if (
        not settings.outbound_integrity_checks_enabled
        or not settings.play_integrity_enabled
        or not settings.play_integrity_package_name
        or not settings.play_integrity_api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=Messages.PLAY_INTEGRITY_DISABLED,
        )

    credential = (
        db.query(Credential)
        .filter(Credential.user_id == current_user.id)
        .order_by(Credential.registered_at.desc())
        .first()
    )
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_NO_CREDENTIAL,
        )

    credential_id = credential.credential_id
    rate_key = f"{PI_VOUCH_DAILY_COUNT_PREFIX}{credential_id}:{_today_date_str()}"
    count_bytes = redis_client.get(rate_key)
    count = int(count_bytes.decode()) if count_bytes else 0
    if count >= PI_MAX_DAILY_VOUCHES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=Messages.PLAY_INTEGRITY_RATE_LIMITED,
        )

    try:
        verdict = verify_integrity_token(body.integrity_token)
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=Messages.PLAY_INTEGRITY_VERIFY_FAILED,
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=Messages.PLAY_INTEGRITY_UNAVAILABLE,
        )

    if PI_REQUIRED_VERDICT not in verdict:
        logger.warning(
            Logs.PLAY_INTEGRITY_VERDICT_FAILED.format(
                credential_id=credential_id, verdict=verdict
            )
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=Messages.PLAY_INTEGRITY_VERDICT_FAILED,
        )

    store_vouch(credential_id)
    new_count = redis_client.incr(rate_key)
    if new_count == 1:
        redis_client.expire(rate_key, _seconds_until_midnight())

    logger.info(Logs.PLAY_INTEGRITY_VOUCH_ISSUED.format(credential_id=credential_id))

    return {"vouched": True, "slots_remaining": PI_MAX_DAILY_VOUCHES - int(new_count)}
