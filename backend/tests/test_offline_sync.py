import json

from api.contracts.device import DEVICE_PAYLOAD_VERSION, DeviceBindingFlow
from api.helpers.device_payload import build_device_payload, canonical_payload_bytes


class TestOfflineCheckInPayload:
    def test_offline_flow_in_payload(self):
        payload = build_device_payload(
            flow=DeviceBindingFlow.OFFLINE_CHECK_IN,
            user_id="user-1",
            session_id="session-1",
            credential_id="cred-1",
            challenge="nonce-abc",
            issued_at_ms=1700000000000,
        )
        assert payload.flow == "offline_check_in"
        assert payload.v == DEVICE_PAYLOAD_VERSION

    def test_canonical_bytes_deterministic(self):
        payload = build_device_payload(
            flow=DeviceBindingFlow.OFFLINE_CHECK_IN,
            user_id="user-1",
            session_id="session-1",
            credential_id="cred-1",
            challenge="nonce-abc",
            issued_at_ms=1700000000000,
        )
        b1 = canonical_payload_bytes(payload)
        b2 = canonical_payload_bytes(payload)
        assert b1 == b2

    def test_canonical_bytes_key_order(self):
        payload = build_device_payload(
            flow=DeviceBindingFlow.OFFLINE_CHECK_IN,
            user_id="user-1",
            session_id="session-1",
            credential_id="cred-1",
            challenge="nonce-abc",
            issued_at_ms=1700000000000,
        )
        raw = canonical_payload_bytes(payload)
        parsed = json.loads(raw)
        keys = list(parsed.keys())
        assert keys == [
            "v",
            "flow",
            "user_id",
            "session_id",
            "credential_id",
            "challenge",
            "issued_at_ms",
        ]

    def test_canonical_bytes_compact_separators(self):
        payload = build_device_payload(
            flow=DeviceBindingFlow.OFFLINE_CHECK_IN,
            user_id="u",
            session_id="s",
            credential_id="c",
            challenge="n",
            issued_at_ms=0,
        )
        raw = canonical_payload_bytes(payload).decode()
        assert " " not in raw
        assert ": " not in raw
        assert ", " not in raw


class TestOfflineSyncRecordSchema:
    def test_nonce_set_validation(self):
        import pytest
        from api.schemas import OfflineSyncRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            OfflineSyncRequest(
                class_id="c1",
                opened_at="2025-01-01T00:00:00Z",
                closed_at="2025-01-01T01:00:00Z",
                nonce_set=123,
                records=[],
            )

    def test_empty_records_accepted(self):
        from api.schemas import OfflineSyncRequest

        req = OfflineSyncRequest(
            class_id="c1",
            opened_at="2025-01-01T00:00:00Z",
            closed_at="2025-01-01T01:00:00Z",
            nonce_set=["n1"],
            records=[],
        )
        assert len(req.records) == 0
