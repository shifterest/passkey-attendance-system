import redis

from .config import settings

redis_client = redis.Redis(host=settings.redis_host)

try:
    redis_client.ping()
except redis.ConnectionError as e:
    raise RuntimeError(
        f"Failed to connect to Redis at {settings.redis_host}:6379. Make sure Redis is running."
    ) from e
