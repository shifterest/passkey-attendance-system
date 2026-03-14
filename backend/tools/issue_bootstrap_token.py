import secrets

from api.config import settings
from api.redis import redis_client
from api.routes.bootstrap import BOOTSTRAP_TOKEN_PREFIX


def main() -> int:
    if not settings.bootstrap_enabled:
        print("BOOTSTRAP_ENABLED is false. Enable it before issuing a token.")
        return 1

    token = secrets.token_urlsafe(32)
    redis_client.set(
        f"{BOOTSTRAP_TOKEN_PREFIX}{token}",
        "1",
        ex=settings.bootstrap_token_ttl_seconds,
    )

    print(token)
    print(f"TTL(seconds): {settings.bootstrap_token_ttl_seconds}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
