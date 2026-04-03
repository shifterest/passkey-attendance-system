import re

from api.helpers.assurance import assurance_score_from_verification_methods
from api.helpers.tokens import new_nfc_token
from api.schemas import AttendanceRecordVerificationMethods, CheckInResponseBase

NFC = AttendanceRecordVerificationMethods.NFC.value


class TestNfcScoring:
    def test_nfc_scores_five_when_vouched(self):
        assert assurance_score_from_verification_methods([NFC], integrity_vouched=True) == 5

    def test_nfc_scores_five_when_absent(self):
        assert assurance_score_from_verification_methods([NFC], integrity_vouched=False) == 5

    def test_nfc_not_affected_by_integrity_vouched(self):
        score_vouched = assurance_score_from_verification_methods([NFC], integrity_vouched=True)
        score_absent = assurance_score_from_verification_methods([NFC], integrity_vouched=False)
        assert score_vouched == score_absent

    def test_nfc_adds_to_other_methods(self):
        score = assurance_score_from_verification_methods(
            [NFC, AttendanceRecordVerificationMethods.NETWORK.value],
            integrity_vouched=False,
        )
        assert score == 7


class TestNfcToken:
    def test_new_nfc_token_returns_nonempty_string(self):
        token = new_nfc_token()
        assert isinstance(token, str)
        assert len(token) > 0

    def test_new_nfc_token_is_urlsafe(self):
        token = new_nfc_token()
        assert re.fullmatch(r"[A-Za-z0-9_\-]+", token)

    def test_new_nfc_token_generates_unique_tokens(self):
        tokens = {new_nfc_token() for _ in range(20)}
        assert len(tokens) == 20


class TestNfcSchema:
    def test_nfc_enum_value_is_nfc(self):
        assert AttendanceRecordVerificationMethods.NFC.value == "nfc"

    def test_checkin_response_base_accepts_nfc_token(self):
        obj = CheckInResponseBase(
            user_id="u-1",
            session_id="s-1",
            credential={},
            device_signature="sig",
            device_public_key="pub",
            nfc_token="tok123",
        )
        assert obj.nfc_token == "tok123"

    def test_checkin_response_base_nfc_token_optional(self):
        obj = CheckInResponseBase(
            user_id="u-1",
            session_id="s-1",
            credential={},
            device_signature="sig",
            device_public_key="pub",
        )
        assert obj.nfc_token is None
