from enum import Enum
from typing import Final, TypeAlias

from typing_extensions import Literal

DEVICE_PAYLOAD_VERSION: Final[Literal[1]] = 1
DevicePayloadVersion: TypeAlias = Literal[1]
DEVICE_PAYLOAD_KEYS: Final[tuple[str, ...]] = (
    "v",
    "flow",
    "user_id",
    "session_id",
    "credential_id",
    "challenge",
    "issued_at_ms",
)


class DeviceBindingFlow(str, Enum):
    REGISTER = "register"
    CHECK_IN = "check_in"
    LOGIN = "login"
