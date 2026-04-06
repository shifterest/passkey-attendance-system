import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from api.redis import redis_client
from api.services.audit_service import log_audit_event
from api.strings import AuditEvents
from database.connection import session as SessionLocal
from database.models import AttendanceRecord

logger = logging.getLogger(__name__)

PI_VOUCH_KEY_PREFIX = "pi_vouch:"
PI_VOUCH_EXPIRY_SOON_PREFIX = "pi_vouch_expires_soon:"
OFFLINE_ESCALATION_HOURS = 24


def escalate_stale_offline_records():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=OFFLINE_ESCALATION_HOURS)
        stale_records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.sync_pending.is_(True),
                AttendanceRecord.sync_escalated.is_(False),
                AttendanceRecord.timestamp < cutoff,
            )
            .all()
        )
        for record in stale_records:
            record.sync_escalated = True
            log_audit_event(
                AuditEvents.OFFLINE_RECORD_ESCALATED,
                None,
                record.user_id,
                {"record_id": record.id, "session_id": record.session_id},
                db,
            )
        if stale_records:
            db.commit()
            logger.info(f"Escalated {len(stale_records)} stale offline records")
    except Exception:
        db.rollback()
        logger.exception("Error escalating stale offline records")
    finally:
        db.close()


def flag_expiring_vouches():
    try:
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(
                cursor=cursor, match=f"{PI_VOUCH_KEY_PREFIX}*", count=100
            )
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                credential_id = key_str[len(PI_VOUCH_KEY_PREFIX):]
                ttl = redis_client.ttl(key_str)
                if 0 < ttl <= 7200:
                    redis_client.set(
                        f"{PI_VOUCH_EXPIRY_SOON_PREFIX}{credential_id}",
                        "1",
                        ex=ttl,
                    )
            if cursor == 0:
                break
    except Exception:
        logger.exception("Error checking PI vouch expiry")


scheduler = BackgroundScheduler()
scheduler.add_job(escalate_stale_offline_records, "interval", minutes=30)
scheduler.add_job(flag_expiring_vouches, "interval", hours=1)
