from pathlib import Path

from alembic import command
from alembic.config import Config
from api.config import settings
from database.connection import engine
from sqlalchemy import inspect

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def upgrade_database() -> None:
    command.upgrade(_alembic_config(), "head")


def ensure_database_schema() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if not tables or "alembic_version" in tables:
        upgrade_database()
        return

    raise RuntimeError(
        "Existing database has no Alembic version table. Reset the pre-Alembic database or stamp it explicitly before starting the app."
    )
