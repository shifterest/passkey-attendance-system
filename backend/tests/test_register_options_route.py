import pytest
from api.schemas import RegistrationOptionsBase
from pydantic import ValidationError


def test_registration_options_rejects_extra_fields():
    with pytest.raises(ValidationError):
        RegistrationOptionsBase(
            user_id="u-1",
            registration_token="tok",
            extra_field="should_fail",
        )
