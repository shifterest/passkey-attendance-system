from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Infrastructure
    redis_url: str = "redis://localhost:6379"
    database_url: str = "sqlite+pysqlite:///sqlite/attendance.db"

    # WebAuthn
    web_origin: str = "http://localhost:3000"
    app_origin: str = "android:apk-key-hash:3mg2iB-JtknVTWAQS81rSIMVIWhj2OJ_PjUn-_33134"
    rp_id: str = "attendance.whatta.top"
    rp_name: str = "Passkey Attendance System"
    registration_protocol: str = "shifterest-pas"

    # Timeouts
    challenge_timeout: int = 180
    login_timeout: int = 1800
    registration_timeout: int = 180

    # Credential policy
    max_active_credentials_per_user: int = 1


settings = Settings()
