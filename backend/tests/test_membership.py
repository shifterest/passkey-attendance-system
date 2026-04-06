from unittest.mock import MagicMock

from api.helpers.membership import is_event_attendee, is_org_member


def _make_user(**kwargs):
    user = MagicMock()
    user.id = kwargs.get("id", "user-1")
    user.role = kwargs.get("role", "student")
    user.program = kwargs.get("program", None)
    user.year_level = kwargs.get("year_level", None)
    return user


def _make_rule(**kwargs):
    rule = MagicMock()
    rule.rule_type = kwargs.get("rule_type", "all")
    rule.rule_value = kwargs.get("rule_value", None)
    rule.rule_group = kwargs.get("rule_group", None)
    return rule


def _make_event(**kwargs):
    event = MagicMock()
    event.id = kwargs.get("id", "event-1")
    event.org_id = kwargs.get("org_id", "org-1")
    return event


class TestIsOrgMember:
    def test_explicit_revocation_blocks(self):
        db = MagicMock()
        user = _make_user()
        revocation_mock = MagicMock()
        db.query.return_value.filter.return_value.filter.return_value.first.return_value = revocation_mock
        assert is_org_member(db, user, "org-1") is False

    def test_no_memberships_no_rules_returns_false(self):
        db = MagicMock()
        user = _make_user()
        query_mock = db.query.return_value.filter.return_value
        query_mock.filter.return_value.first.return_value = None
        query_mock.all.return_value = []
        assert is_org_member(db, user, "org-1") is False


class TestIsEventAttendee:
    def test_no_rules_means_eligible(self):
        db = MagicMock()
        user = _make_user()
        event = _make_event()
        db.query.return_value.filter.return_value.all.return_value = []
        eligible, reason = is_event_attendee(db, user, event)
        assert eligible is True
        assert reason is None

    def test_matching_program_rule(self):
        db = MagicMock()
        user = _make_user(program="BSCS")
        event = _make_event()
        rule = _make_rule(rule_type="program", rule_value="BSCS")
        db.query.return_value.filter.return_value.all.return_value = [rule]
        eligible, reason = is_event_attendee(db, user, event)
        assert eligible is True

    def test_non_matching_program_rule_gives_reason(self):
        db = MagicMock()
        user = _make_user(program="BSIT")
        event = _make_event()
        rule = _make_rule(rule_type="program", rule_value="BSCS")
        db.query.return_value.filter.return_value.all.return_value = [rule]
        eligible, reason = is_event_attendee(db, user, event)
        assert eligible is False
        assert "program=BSCS" in reason

    def test_year_level_rule(self):
        db = MagicMock()
        user = _make_user(year_level=4)
        event = _make_event()
        rule = _make_rule(rule_type="year_level", rule_value="4")
        db.query.return_value.filter.return_value.all.return_value = [rule]
        eligible, reason = is_event_attendee(db, user, event)
        assert eligible is True

    def test_all_rule_matches_anyone(self):
        db = MagicMock()
        user = _make_user()
        event = _make_event()
        rule = _make_rule(rule_type="all", rule_value=None)
        db.query.return_value.filter.return_value.all.return_value = [rule]
        eligible, reason = is_event_attendee(db, user, event)
        assert eligible is True
