import cbor2
import httpx
from api.config import settings
from api.helpers.android.roots import (
    google_hardware_attestation_roots as _google_hardware_attestation_roots,
)
from api.helpers.android.roots import (
    is_legacy_google_hardware_attestation_root,
    is_trusted_google_attestation_root,
)
from api.strings import Messages
from cryptography import x509
from cryptography.x509 import ObjectIdentifier
from pyasn1.codec.der.decoder import decode as der_decode
from webauthn.helpers.asn1.android_key import KeyDescription
from webauthn.helpers.structs import AttestationFormat

_ANDROID_KEY_ATTESTATION_OID = "1.3.6.1.4.1.11129.2.1.17"
_ANDROID_KEY_CRL_URL = "https://android.googleapis.com/attestation/status"
_ATTESTATION_KEY_OID = ObjectIdentifier(_ANDROID_KEY_ATTESTATION_OID)
_SECURITY_LEVEL_MAP: dict[int, str] = {0: "software", 1: "tee", 2: "strongbox"}
_HARDWARE_BACKED_SECURITY_LEVELS = frozenset({"tee", "strongbox"})


def _load_attestation_certificates(attestation_object: bytes) -> list[x509.Certificate]:
    att_obj = cbor2.loads(attestation_object)
    x5c = att_obj.get("attStmt", {}).get("x5c")
    if not x5c or not isinstance(x5c, list):
        raise ValueError(Messages.ATTESTATION_CERT_CHAIN_MISSING)

    certificates: list[x509.Certificate] = []
    for cert_bytes in x5c:
        if not isinstance(cert_bytes, (bytes, bytearray)):
            raise ValueError(Messages.ATTESTATION_CERT_CHAIN_INVALID)
        certificates.append(x509.load_der_x509_certificate(bytes(cert_bytes)))

    return certificates


def _parse_key_description(certificates: list[x509.Certificate]):
    for certificate in certificates:
        try:
            ext = certificate.extensions.get_extension_for_oid(_ATTESTATION_KEY_OID)
        except x509.ExtensionNotFound:
            continue

        ext_value = ext.value
        if not isinstance(ext_value, x509.UnrecognizedExtension):
            raise ValueError(Messages.ATTESTATION_EXTENSION_UNEXPECTED_FORMAT)

        parsed_ext, trailing_garbage = der_decode(
            ext_value.value,
            asn1Spec=KeyDescription(),
        )
        if trailing_garbage:
            raise ValueError(Messages.ATTESTATION_EXTENSION_TRAILING_DATA)
        return parsed_ext

    raise ValueError(Messages.ATTESTATION_EXTENSION_MISSING)


def _parse_android_key_info(
    attestation_object: bytes,
) -> tuple[list[x509.Certificate], str | None]:
    certificates = _load_attestation_certificates(attestation_object)
    parsed_ext = _parse_key_description(certificates)
    level_int = int(parsed_ext["attestationSecurityLevel"])
    return certificates, _SECURITY_LEVEL_MAP.get(level_int)


def is_hardware_backed_security_level(level: str | None) -> bool:
    return level in _HARDWARE_BACKED_SECURITY_LEVELS


def google_hardware_attestation_roots() -> list[bytes]:
    return _google_hardware_attestation_roots()


def fetch_crl_status(leaf_cert: x509.Certificate) -> bool | None:
    if not (settings.crl_check_enabled and settings.outbound_integrity_checks_enabled):
        return None
    try:
        response = httpx.get(_ANDROID_KEY_CRL_URL, timeout=5.0)
        response.raise_for_status()
        entries: dict = response.json().get("entries", {})
        serial_hex = format(leaf_cert.serial_number, "X")
        for key in entries:
            if key.upper() == serial_hex.upper():
                return False
        return True
    except Exception:
        return None


def validate_android_key_attestation(
    fmt: AttestationFormat, attestation_object: bytes
) -> tuple[str, bool, str, bool | None]:
    if fmt != AttestationFormat.ANDROID_KEY:
        raise ValueError(Messages.ATTESTATION_ANDROID_KEY_REQUIRED)

    certificates, key_security_level = _parse_android_key_info(attestation_object)
    root_certificate = certificates[-1]
    root_serial_hex = hex(root_certificate.serial_number)
    if not is_trusted_google_attestation_root(root_certificate):
        raise ValueError(Messages.ATTESTATION_ROOT_NOT_TRUSTED)
    if key_security_level is None:
        raise ValueError(Messages.ATTESTATION_SECURITY_LEVEL_MISSING)
    if not is_hardware_backed_security_level(key_security_level):
        raise ValueError(Messages.ATTESTATION_NOT_HARDWARE_BACKED)

    is_legacy_root = is_legacy_google_hardware_attestation_root(root_certificate)
    crl_verified = fetch_crl_status(certificates[0])
    return key_security_level, is_legacy_root, root_serial_hex, crl_verified
