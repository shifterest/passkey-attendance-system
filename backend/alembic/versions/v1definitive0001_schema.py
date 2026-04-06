"""v1 definitive schema

Revision ID: v1definitive0001
Revises:
Create Date: 2026-04-06 22:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
from database.connection import Base

# Ensure model metadata is registered before create_all/drop_all.
import database.models  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "v1definitive0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    """Downgrade schema."""
    Base.metadata.drop_all(bind=op.get_bind())
