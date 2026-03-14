import logging

import fastapi
from db.migrations import ensure_database_schema
from starlette.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .config import settings
from .routes import (
    admin,
    bootstrap,
    check_in,
    classes,
    credentials,
    enrollments,
    integrity,
    login,
    records,
    register,
    sessions,
    students,
    users,
)

logger = logging.getLogger(__name__)
app = fastapi.FastAPI()


@app.on_event("startup")
def apply_database_migrations() -> None:
    ensure_database_schema()


if settings.trusted_proxy:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_proxy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(bootstrap.router)
app.include_router(check_in.router)
app.include_router(classes.router)
app.include_router(credentials.router)
app.include_router(enrollments.router)
app.include_router(integrity.router)
app.include_router(login.router)
app.include_router(records.router)
app.include_router(register.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(users.router)
