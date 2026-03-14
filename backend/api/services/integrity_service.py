import logging

import httpx
from api.config import settings
from api.redis import redis_client

logger = logging.getLogger(__name__)

PI_VOUCH_KEY_PREFIX = "pi_vouch:"
PI_VOUCH_TTL_SECONDS = 86400


def verify_integrity_token(token: str) -> list[str]:
    response = httpx.post(
        f"https://playintegrity.googleapis.com/v1/{settings.play_integrity_package_name}:decodeIntegrityToken",
        params={"key": settings.play_integrity_api_key},
        json={"integrity_token": token},
        timeout=10.0,
    )
    response.raise_for_status()
    data = response.json()
    return (
        data.get("tokenPayloadExternal", {})
        .get("deviceIntegrity", {})
        .get("deviceRecognitionVerdict", [])
    )


def has_valid_vouch(credential_id: str) -> bool:
    return redis_client.exists(f"{PI_VOUCH_KEY_PREFIX}{credential_id}") == 1


def store_vouch(credential_id: str) -> None:
    redis_client.set(
        f"{PI_VOUCH_KEY_PREFIX}{credential_id}", "1", ex=PI_VOUCH_TTL_SECONDS
    )
