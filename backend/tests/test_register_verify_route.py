import importlib
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from api.schemas import RegistrationResponseBase
from api.strings import Messages
from fastapi import HTTPException
from webauthn.helpers.exceptions import InvalidJSONStructure


def test_register_verify_maps_webauthn_parse_errors_to_bad_request(monkeypatch):
    fake_redis_client = SimpleNamespace(getdel=lambda key: b"challenge")
    monkeypatch.setitem(
        sys.modules,
        "api.redis",
        SimpleNamespace(redis_client=fake_redis_client),
    )
    sys.modules.pop("api.routes.register", None)
    register = importlib.import_module("api.routes.register")

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
        id="user-1"
    )

    response_data = RegistrationResponseBase(
        user_id="user-1",
        registration_token="token-1",
        device_signature="signature",
        device_public_key="public-key",
        credential={},
    )

    monkeypatch.setattr(register, "check_auth_rate_limit", lambda user_id: None)
    monkeypatch.setattr(
        register,
        "validate_registration_token",
        lambda token, expected_user_id, consume=False: expected_user_id,
    )
    monkeypatch.setattr(
        register,
        "load_issued_at_ms",
        lambda key, pending_error_message: int(
            datetime.now(timezone.utc).timestamp() * 1000
        ),
    )

    def raise_invalid_json(**kwargs):
        raise InvalidJSONStructure("Credential missing required rawId")

    monkeypatch.setattr(register, "verify_registration_response", raise_invalid_json)

    with pytest.raises(HTTPException) as exc_info:
        register.register_verify(response_data, db)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == Messages.REGISTER_VERIFY_FAILED
