import logging
from contextlib import asynccontextmanager

import fastapi
from database.migrations import ensure_database_schema
from starlette.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .config import settings
from .routes import (
    admin,
    audit,
    bootstrap,
    root,
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
    sessions,
    students,
    teachers,
    users,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: fastapi.FastAPI):
    ensure_database_schema()
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
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(teachers.router)
app.include_router(users.router)
