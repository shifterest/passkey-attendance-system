from pathlib import Path

from alembic import command
from alembic.util.exc import CommandError
from alembic.config import Config
from api.config import settings
from database.connection import engine
from sqlalchemy import inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
SQUASHED_HEAD_REVISION = "v1definitive0001"


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def upgrade_database() -> None:
    command.upgrade(_alembic_config(), "head")


def stamp_database_head() -> None:
    command.stamp(_alembic_config(), "head")


def force_set_alembic_head() -> None:
    with engine.begin() as connection:
        count = connection.execute(text("SELECT COUNT(*) FROM alembic_version")).scalar()
        if count and int(count) > 0:
            connection.execute(
                text("UPDATE alembic_version SET version_num = :revision"),
                {"revision": SQUASHED_HEAD_REVISION},
            )
        else:
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": SQUASHED_HEAD_REVISION},
            )


def ensure_database_schema() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if not tables or "alembic_version" in tables:
        try:
            upgrade_database()
            return
        except CommandError as exc:
            message = str(exc)
            if (
                "Can't locate revision identified by" in message
                and tables
                and "alembic_version" in tables
            ):
                force_set_alembic_head()
                return
            raise

    raise RuntimeError(
        "Existing database has no Alembic version table. Reset the pre-Alembic database or stamp it explicitly before starting the app."
    )
