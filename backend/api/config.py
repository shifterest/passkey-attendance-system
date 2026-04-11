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
    database_url: str = "postgresql+psycopg://pas:changeme@localhost:5432/attendance"

    # WebAuthn
    web_origin: str = "http://localhost:3000"
    app_origin: str = "android:apk-key-hash:3mg2iB-JtknVTWAQS81rSIMVIWhj2OJ_PjUn-_33134"
    rp_id: str = "attendance.whatta.top"
    rp_name: str = "Passkey Attendance System"
    registration_protocol: str = "shifterest-pas"

    # Timeouts
    challenge_timeout: int = 180
    login_timeout: int = 1800
    login_timeout_privileged: int = 2592000
    registration_timeout: int = 180
    web_login_token_ttl_seconds: int = 120
    web_login_poll_interval_hint: int = 3

    # Credential policy
    max_active_credentials_per_user: int = 1
    device_payload_max_age_ms: int = 30000
    max_check_ins_per_session: int = 3

    # Rate limiting
    auth_user_ratelimit_max: int = 5
    auth_user_ratelimit_window: int = 60

    # Play Integrity
    play_integrity_enabled: bool = False
    play_integrity_package_name: str = ""
    play_integrity_api_key: str = ""
    android_key_attestation_required: bool = False

    # Outbound integrity checks
    outbound_integrity_checks_enabled: bool = False
    crl_check_enabled: bool = True

    # Bootstrap
    bootstrap_enabled: bool = False
    bootstrap_token_ttl_seconds: int = 86400

    # Deferred surfaces
    org_events_enabled: bool = False

    # Network proximity
    school_subnet_cidr: str | None = None
    trusted_proxy: str | None = None
    ble_token_ttl_seconds: int = 30

    # School geofence
    school_lat: float | None = None
    school_lng: float | None = None
    school_geofence_radius_m: float = 200.0

    # Timezone
    server_timezone: str = "Asia/Manila"


settings = Settings()
