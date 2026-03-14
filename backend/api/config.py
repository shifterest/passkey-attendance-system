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
    device_payload_max_age_ms: int = 30000
    max_check_ins_per_session: int = 3

    # Rate limiting
    auth_user_ratelimit_max: int = 5
    auth_user_ratelimit_window: int = 60

    # Play Integrity
    play_integrity_package_name: str = ""
    play_integrity_api_key: str = ""

    # Bootstrap
    bootstrap_enabled: bool = False
    bootstrap_token_ttl_seconds: int = 300

    # Timezone
    server_timezone: str = "Asia/Manila"

    # Reverse proxy
    trusted_proxy: str | None = None


settings = Settings()
