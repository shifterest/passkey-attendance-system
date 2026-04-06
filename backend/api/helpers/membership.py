from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from api.schemas import OrgMembershipRuleType, OrgMembershipType
from database.models import (
    OrganizationMembership,
    OrganizationMembershipRule,
)

if TYPE_CHECKING:
    from database.models import Event, User
    from sqlalchemy.orm import Session


def _evaluate_rule(rule: OrganizationMembershipRule, user: User) -> bool:
    rt = rule.rule_type
    rv = rule.rule_value
    if rt == OrgMembershipRuleType.ALL.value:
        return True
    if rt == OrgMembershipRuleType.ROLE.value:
        return user.role == rv
    if rt == OrgMembershipRuleType.PROGRAM.value:
        return user.program is not None and user.program == rv
    if rt == OrgMembershipRuleType.YEAR_LEVEL.value:
        try:
            return user.year_level is not None and user.year_level == int(rv)
        except (TypeError, ValueError):
            return False
    return False


def is_org_member(db: Session, user: User, org_id: str) -> bool:
    now = datetime.now(timezone.utc)

    revocation = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.org_id == org_id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.membership_type == OrgMembershipType.EXPLICIT_REVOCATION.value,
        )
        .filter(
            (OrganizationMembership.expires_at.is_(None))
            | (OrganizationMembership.expires_at > now)
        )
        .first()
    )
    if revocation is not None:
        return False

    explicit = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.org_id == org_id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.membership_type.in_([
                OrgMembershipType.EXPLICIT_GRANT.value,
                OrgMembershipType.ROLE_ELEVATION.value,
            ]),
        )
        .filter(
            (OrganizationMembership.expires_at.is_(None))
            | (OrganizationMembership.expires_at > now)
        )
        .first()
    )
    if explicit is not None:
        return True

    rules = (
        db.query(OrganizationMembershipRule)
        .filter(OrganizationMembershipRule.org_id == org_id)
        .all()
    )
    return any(_evaluate_rule(rule, user) for rule in rules)


def get_org_role(db: Session, user_id: str, org_id: str) -> str | None:
    now = datetime.now(timezone.utc)
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.org_id == org_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.membership_type.in_([
                OrgMembershipType.EXPLICIT_GRANT.value,
                OrgMembershipType.ROLE_ELEVATION.value,
            ]),
        )
        .filter(
            (OrganizationMembership.expires_at.is_(None))
            | (OrganizationMembership.expires_at > now)
        )
        .order_by(OrganizationMembership.granted_at.desc())
        .first()
    )
    return membership.org_role if membership else None


def _evaluate_event_rule(rule, user: User, db: Session) -> bool:
    rt = rule.rule_type
    rv = rule.rule_value
    if rt == "all":
        return True
    if rt == "role":
        return user.role == rv
    if rt == "program":
        return user.program is not None and user.program == rv
    if rt == "year_level":
        try:
            return user.year_level is not None and user.year_level == int(rv)
        except (TypeError, ValueError):
            return False
    if rt == "org_member":
        if rv is None:
            return False
        return is_org_member(db, user, rv)
    return False


def is_event_attendee(db: Session, user: User, event: Event) -> tuple[bool, str | None]:
    from database.models import EventAttendeeRule

    rules = (
        db.query(EventAttendeeRule)
        .filter(EventAttendeeRule.event_id == event.id)
        .all()
    )
    if not rules:
        return (True, None)

    for rule in rules:
        if _evaluate_event_rule(rule, user, db):
            return (True, None)

    criteria = []
    for rule in rules:
        if rule.rule_value:
            criteria.append(f"{rule.rule_type}={rule.rule_value}")
        else:
            criteria.append(rule.rule_type)
    reason = f"Eligibility criteria: [{', '.join(criteria)}]. Your profile does not match any rule."
    return (False, reason)
