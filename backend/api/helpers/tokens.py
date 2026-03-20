import secrets


def new_ble_token() -> str:
    return secrets.token_urlsafe(32)
