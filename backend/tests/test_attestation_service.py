from unittest.mock import MagicMock, patch

import httpx
import pytest
from api.services.attestation_service import (
    fetch_crl_status,
    is_hardware_backed_security_level,
    validate_android_key_attestation,
)
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from datetime import datetime, timezone
from cryptography.hazmat.primitives import hashes
from webauthn.helpers.structs import AttestationFormat


def _make_cert(serial: int) -> x509.Certificate:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test")])
    return (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(serial)
        .not_valid_before(datetime(2024, 1, 1, tzinfo=timezone.utc))
        .not_valid_after(datetime(2030, 1, 1, tzinfo=timezone.utc))
        .sign(key, hashes.SHA256())
    )


def test_tee_is_hardware_backed():
    assert is_hardware_backed_security_level("tee") is True


def test_strongbox_is_hardware_backed():
    assert is_hardware_backed_security_level("strongbox") is True


def test_software_is_not_hardware_backed():
    assert is_hardware_backed_security_level("software") is False


def test_validate_android_key_attestation_rejects_non_android_key_format():
    with pytest.raises(ValueError):
        validate_android_key_attestation(AttestationFormat.PACKED, b"")


@patch("api.services.attestation_service.settings")
def test_fetch_crl_status_disabled_returns_none(mock_settings):
    mock_settings.crl_check_enabled = False
    mock_settings.outbound_integrity_checks_enabled = True
    cert = _make_cert(serial=0xABCD)
    assert fetch_crl_status(cert) is None


@patch("api.services.attestation_service.settings")
def test_fetch_crl_status_outbound_disabled_returns_none(mock_settings):
    mock_settings.crl_check_enabled = True
    mock_settings.outbound_integrity_checks_enabled = False
    cert = _make_cert(serial=0xABCD)
    assert fetch_crl_status(cert) is None


@patch("api.services.attestation_service.settings")
@patch("api.services.attestation_service.httpx.get")
def test_fetch_crl_status_not_revoked_returns_true(mock_get, mock_settings):
    mock_settings.crl_check_enabled = True
    mock_settings.outbound_integrity_checks_enabled = True
    mock_response = MagicMock()
    mock_response.json.return_value = {"entries": {"FFFF": {"status": "REVOKED"}}}
    mock_get.return_value = mock_response
    cert = _make_cert(serial=0xABCD)
    assert fetch_crl_status(cert) is True


@patch("api.services.attestation_service.settings")
@patch("api.services.attestation_service.httpx.get")
def test_fetch_crl_status_revoked_returns_false(mock_get, mock_settings):
    mock_settings.crl_check_enabled = True
    mock_settings.outbound_integrity_checks_enabled = True
    serial = 0xABCD
    mock_response = MagicMock()
    mock_response.json.return_value = {"entries": {"ABCD": {"status": "REVOKED"}}}
    mock_get.return_value = mock_response
    cert = _make_cert(serial=serial)
    assert fetch_crl_status(cert) is False


@patch("api.services.attestation_service.settings")
@patch("api.services.attestation_service.httpx.get")
def test_fetch_crl_status_network_error_returns_none(mock_get, mock_settings):
    mock_settings.crl_check_enabled = True
    mock_settings.outbound_integrity_checks_enabled = True
    mock_get.side_effect = httpx.ConnectError("unreachable")
    cert = _make_cert(serial=0xABCD)
    assert fetch_crl_status(cert) is None
