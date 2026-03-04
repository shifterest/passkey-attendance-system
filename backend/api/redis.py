import redis

from .config import settings

redis_client = redis.Redis.from_url(settings.redis_url, retry_on_timeout=True)

try:
    redis_client.ping()
except redis.ConnectionError as e:
    raise RuntimeError(
        f"Failed to connect to Redis at {settings.redis_url}. Make sure Redis is running."
    ) from e
