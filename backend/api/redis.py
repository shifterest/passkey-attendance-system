import redis

from .config import settings

redis_client = redis.Redis(host=settings.redis_host, port=settings.redis_port)

try:
    redis_client.ping()
except redis.ConnectionError as e:
    raise RuntimeError(
        f"Failed to connect to Redis at {settings.redis_host}:{settings.redis_port}. Make sure Redis is running."
    ) from e
