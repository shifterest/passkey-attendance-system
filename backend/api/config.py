from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Hosts and ports
    redis_host: str = "localhost"
    redis_port: int = 6379
    backend_port: int = 8000
    frontend_port: int = 3000

    # Timeouts
    challenge_timeout: int = 180
    login_timeout: int = 1800
    registration_timeout: int = 180

    # Constants
    rp_id: str = "attendance.softeng.com"
    rp_name: str = "Passkey Attendance System"
    protocol: str = "pas"

    @computed_field
    @property
    def expected_origin(self) -> str:
        return f"http://localhost:{self.frontend_port}"


settings = Settings()
