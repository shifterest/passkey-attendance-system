import base64
import binascii
import json
from typing import Any

from api.contracts.device import DEVICE_PAYLOAD_KEYS
from api.schemas import DeviceBindingPayload

from api.strings import Messages


def encode_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def decode_base64url(value: str) -> bytes:
    padded = value + ("=" * ((4 - len(value) % 4) % 4))
    return base64.urlsafe_b64decode(padded)


def extract_credential_id(credential: dict[str, Any]) -> str | None:
    credential_id = credential.get("id")
    if isinstance(credential_id, str):
        return credential_id

    raw_id = credential.get("rawId")
    if isinstance(raw_id, str):
        return raw_id

    return None


def normalize_credential_id_base64url(credential: dict[str, Any]) -> str | None:
    credential_id = extract_credential_id(credential)
    if credential_id is None:
        return None

    try:
        return encode_base64url(decode_base64url(credential_id))
    except (binascii.Error, ValueError):
        return None


def credential_id_matches(
    stored_credential_id: str,
    asserted_credential_id_base64url: str,
) -> bool:
    if stored_credential_id == asserted_credential_id_base64url:
        return True

    try:
        return (
            stored_credential_id
            == decode_base64url(asserted_credential_id_base64url).hex()
        )
    except (binascii.Error, ValueError):
        return False


def canonical_payload_bytes(payload: DeviceBindingPayload) -> bytes:
    canonical_payload = {
        "v": payload.v,
        "flow": payload.flow,
        "user_id": payload.user_id,
        "session_id": payload.session_id,
        "credential_id": payload.credential_id,
        "challenge": payload.challenge,
        "issued_at_ms": payload.issued_at_ms,
    }
    if tuple(canonical_payload.keys()) != DEVICE_PAYLOAD_KEYS:
        raise ValueError(Messages.DEVICE_BINDING_PAYLOAD_KEYS_INVALID)

    return json.dumps(
        canonical_payload,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

