import logging

import fastapi
from starlette.middleware.cors import CORSMiddleware

from .config import BACKEND_PORT, FRONTEND_PORT
from .routes import (
    auth,
    bootstrap,
    classes,
    credentials,
    enrollments,
    records,
    sessions,
    users,
)

logger = logging.getLogger(__name__)
app = fastapi.FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{FRONTEND_PORT}",
        f"http://localhost:{BACKEND_PORT}",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bootstrap.router)
app.include_router(classes.router)
app.include_router(credentials.router)
app.include_router(enrollments.router)
app.include_router(records.router)
app.include_router(sessions.router)
app.include_router(users.router)
