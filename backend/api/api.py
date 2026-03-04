import logging

import fastapi
from starlette.middleware.cors import CORSMiddleware

from .config import settings
from .routes import (
    admin,
    auth,
    bootstrap,
    classes,
    credentials,
    enrollments,
    records,
    sessions,
    students,
    users,
)

logger = logging.getLogger(__name__)
app = fastapi.FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(bootstrap.router)
app.include_router(classes.router)
app.include_router(credentials.router)
app.include_router(enrollments.router)
app.include_router(records.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(users.router)
