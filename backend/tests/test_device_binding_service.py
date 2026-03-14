from api.contracts.device import DeviceBindingFlow
from api.schemas import DeviceBindingPayload
from api.services.device_service import (
    canonical_payload_bytes,
    credential_id_matches,
    normalize_credential_id_base64url,
)


def test_canonical_payload_bytes_pas_json_v1_shape():
    payload = DeviceBindingPayload(
        v=1,
        flow=DeviceBindingFlow.CHECK_IN,
        user_id="u-1",
        session_id="s-1",
        credential_id="AQ",
        challenge="c-1",
        issued_at_ms=123,
    )

    assert canonical_payload_bytes(payload) == (
        b'{"v":1,"flow":"check_in","user_id":"u-1","session_id":"s-1",'
        b'"credential_id":"AQ","challenge":"c-1","issued_at_ms":123}'
    )


def test_normalize_credential_id_base64url_accepts_padded_or_unpadded():
    assert normalize_credential_id_base64url({"id": "AQ=="}) == "AQ"
    assert normalize_credential_id_base64url({"id": "AQ"}) == "AQ"
    assert normalize_credential_id_base64url({"rawId": "AQ=="}) == "AQ"


def test_credential_id_match_supports_base64url_and_legacy_hex():
    assert credential_id_matches("AQ", "AQ")
    assert credential_id_matches("01", "AQ")
    assert not credential_id_matches("ff", "AQ")
