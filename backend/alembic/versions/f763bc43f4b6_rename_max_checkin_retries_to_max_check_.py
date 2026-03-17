"""rename_max_checkin_retries_to_max_check_ins

Revision ID: f763bc43f4b6
Revises: cfb426536950
Create Date: 2026-03-15 11:10:34.271268

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f763bc43f4b6"
down_revision: Union[str, Sequence[str], None] = "cfb426536950"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("class_policies", schema=None) as batch_op:
        batch_op.alter_column("max_checkin_retries", new_column_name="max_check_ins")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("class_policies", schema=None) as batch_op:
        batch_op.alter_column("max_check_ins", new_column_name="max_checkin_retries")
