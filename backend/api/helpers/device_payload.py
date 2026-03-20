import json

from api.contracts.device import (
    DEVICE_PAYLOAD_KEYS,
    DEVICE_PAYLOAD_VERSION,
    DeviceBindingFlow,
)
from api.schemas import DeviceBindingPayload
from api.strings import Messages


def build_device_payload(
    flow: DeviceBindingFlow,
    user_id: str,
    session_id: str | None,
    credential_id: str | None,
    challenge: str,
    issued_at_ms: int,
) -> DeviceBindingPayload:
    return DeviceBindingPayload(
        v=DEVICE_PAYLOAD_VERSION,
        flow=flow,
        user_id=user_id,
        session_id=session_id,
        credential_id=credential_id,
        challenge=challenge,
        issued_at_ms=issued_at_ms,
    )


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
