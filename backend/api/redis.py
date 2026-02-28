import redis

from . import config

redis_client = redis.Redis(host=config.REDIS_HOST, port=config.REDIS_PORT)

try:
    redis_client.ping()
except redis.ConnectionError as e:
    raise RuntimeError(
        f"Failed to connect to Redis at {config.REDIS_HOST}:{config.REDIS_PORT}. Make sure Redis is running."
    ) from e
