import pytest
from api.services.attestation_service import (
    is_hardware_backed_security_level,
    validate_android_key_attestation,
)
from webauthn.helpers.structs import AttestationFormat


def test_tee_is_hardware_backed():
    assert is_hardware_backed_security_level("tee") is True


def test_strongbox_is_hardware_backed():
    assert is_hardware_backed_security_level("strongbox") is True


def test_software_is_not_hardware_backed():
    assert is_hardware_backed_security_level("software") is False


def test_validate_android_key_attestation_rejects_non_android_key_format():
    with pytest.raises(ValueError):
        validate_android_key_attestation(AttestationFormat.PACKED, b"")
