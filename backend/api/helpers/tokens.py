import secrets


def new_ble_token() -> str:
    return secrets.token_urlsafe(32)


def new_nfc_token() -> str:
    return secrets.token_urlsafe(32)
