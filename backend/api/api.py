import logging
import secrets
from contextlib import asynccontextmanager

import fastapi
from database.migrations import ensure_database_schema
from starlette.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .config import settings
from .redis import redis_client
from .routes import (
    admin,
    audit,
    bootstrap,
    check_in,
    classes,
    credentials,
    enrollments,
    events,
    integrity,
    login,
    orgs,
    policies,
    records,
    register,
    root,
    semesters,
    sessions,
    students,
    teachers,
    users,
)

logger = logging.getLogger(__name__)


def _maybe_issue_bootstrap_token() -> None:
    if not settings.bootstrap_enabled:
        return

    from api.schemas import UserRole
    from database.connection import session as SessionLocal
    from database.models import User

    from .routes.bootstrap import BOOTSTRAP_COMPLETED_KEY, BOOTSTRAP_TOKEN_PREFIX

    if redis_client.get(BOOTSTRAP_COMPLETED_KEY):
        return

    db = SessionLocal()
    try:
        has_privileged = (
            db.query(User.id)
            .filter(User.role.in_([UserRole.OPERATOR, UserRole.ADMIN]))
            .first()
            is not None
        )
        if has_privileged:
            return
    finally:
        db.close()

    for key in redis_client.scan_iter(match=f"{BOOTSTRAP_TOKEN_PREFIX}*"):
        redis_client.delete(key)

    token = secrets.token_urlsafe(32)
    redis_client.set(
        f"{BOOTSTRAP_TOKEN_PREFIX}{token}",
        "1",
        ex=settings.bootstrap_token_ttl_seconds,
    )

    logger.info(
        "\n"
        "============================================================\n"
        "  BOOTSTRAP TOKEN: %s\n"
        "  Paste this into the web login page.\n"
        "  Valid for %d seconds. Single-use.\n"
        "============================================================",
        token,
        settings.bootstrap_token_ttl_seconds,
    )


@asynccontextmanager
async def _lifespan(app: fastapi.FastAPI):
    ensure_database_schema()
    _maybe_issue_bootstrap_token()
    from api.worker import scheduler

    scheduler.start()
    yield
    scheduler.shutdown()


app = fastapi.FastAPI(lifespan=_lifespan)


if settings.trusted_proxy:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_proxy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(root.router)
app.include_router(admin.router)
app.include_router(audit.router)
app.include_router(bootstrap.router)
app.include_router(check_in.router)
app.include_router(classes.router)
app.include_router(credentials.router)
app.include_router(enrollments.router)
app.include_router(events.router)
app.include_router(integrity.router)
app.include_router(login.router)
app.include_router(orgs.router)
app.include_router(policies.router)
app.include_router(records.router)
app.include_router(register.router)
app.include_router(semesters.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(teachers.router)
app.include_router(users.router)
