import logging

import fastapi
import redis
from api.config import *
from api.routes import (
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
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
app = fastapi.FastAPI()

app.include_router(auth.router)
app.include_router(bootstrap.router)
app.include_router(classes.router)
app.include_router(credentials.router)
app.include_router(enrollments.router)
app.include_router(records.router)
app.include_router(sessions.router)
app.include_router(users.router)
