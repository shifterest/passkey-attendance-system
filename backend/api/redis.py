from datetime import timedelta
from typing import Protocol

import redis

from .config import settings


# Redis has ass type stubs so we gotta do this
class _SyncRedis(Protocol):
    def get(self, name: str) -> bytes | None: ...
    def getdel(self, name: str) -> bytes | None: ...
    def set(
        self,
        name: str,
        value: str | bytes | int | float,
        *,
        ex: int | timedelta | None = None,
        nx: bool = False,
    ) -> None: ...
    def delete(self, *names: str) -> None: ...
    def incr(self, name: str) -> int: ...
    def incrby(self, name: str, amount: int) -> int: ...
    def ttl(self, name: str) -> int: ...
    def exists(self, *names: str) -> int: ...
    def expire(self, name: str, time: int) -> None: ...
    def ping(self) -> None: ...


redis_client: _SyncRedis = redis.Redis.from_url(  # type: ignore[assignment]
    settings.redis_url, retry_on_timeout=True
)

try:
    redis_client.ping()
except redis.ConnectionError as e:
    raise RuntimeError(
        f"Failed to connect to Redis at {settings.redis_url}. Make sure Redis is running."
    ) from e
