import binascii
from typing import Any

from api.helpers.base64url import decode_base64url, encode_base64url


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
