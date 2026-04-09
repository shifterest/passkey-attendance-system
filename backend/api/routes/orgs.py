import logging
import uuid
from datetime import datetime, timezone

from api.helpers.membership import get_org_role, is_org_member
from api.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    OrgMembershipCreate,
    OrgMembershipResponse,
    OrgMembershipRuleCreate,
    OrgMembershipRuleResponse,
    OrgRole,
)
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Messages
from database.connection import get_db
from database.models import (
    Organization,
    OrganizationMembership,
    OrganizationMembershipRule,
    User,
)
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orgs", tags=["organizations"])


def _require_org_role(
    db: Session,
    current_user: User,
    org_id: str,
    min_roles: list[str],
) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    if current_user.role in ("admin", "operator"):
        return org
    role = get_org_role(db, current_user.id, org_id)
    if role not in min_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    return org


@router.post("/", response_model=OrganizationResponse)
def create_org(
    org_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    org = Organization(
        id=str(uuid.uuid4()),
        name=org_data.name,
        description=org_data.description,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(org)
    log_audit_event(
        AuditEvents.ORG_CREATED,
        current_user.id,
        org.id,
        {"name": org.name},
        db,
    )
    db.commit()
    db.refresh(org)
    return org


@router.get("/", response_model=list[OrganizationResponse])
def list_orgs(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    return db.query(Organization).offset(offset).limit(limit).all()


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_org(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    if current_user.role not in ("admin", "operator"):
        if not is_org_member(db, current_user, org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    return org


@router.put("/{org_id}", response_model=OrganizationResponse)
def update_org(
    org_id: str,
    org_data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    org = _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    for key, value in org_data.model_dump(exclude_unset=True).items():
        setattr(org, key, value)
    log_audit_event(
        AuditEvents.ORG_UPDATED,
        current_user.id,
        org_id,
        {"fields": list(org_data.model_dump(exclude_unset=True).keys())},
        db,
    )
    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}")
def delete_org(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    log_audit_event(
        AuditEvents.ORG_DELETED,
        current_user.id,
        org_id,
        {"name": org.name},
        db,
    )
    db.delete(org)
    db.commit()
    return Response(status_code=204)


@router.get("/{org_id}/members", response_model=list[OrgMembershipResponse])
def list_members(
    org_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(
        db,
        current_user,
        org_id,
        [
            OrgRole.MODERATOR.value,
            OrgRole.EVENT_CREATOR.value,
            OrgRole.ADMIN.value,
        ],
    )
    return (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.org_id == org_id)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post("/{org_id}/members", response_model=OrgMembershipResponse)
def grant_membership(
    org_id: str,
    data: OrgMembershipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    membership = OrganizationMembership(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=data.user_id,
        membership_type=data.membership_type,
        org_role=data.org_role,
        granted_at=datetime.now(timezone.utc),
        expires_at=data.expires_at,
        granted_by=current_user.id,
    )
    db.add(membership)
    log_audit_event(
        AuditEvents.ORG_MEMBERSHIP_GRANTED,
        current_user.id,
        membership.id,
        {"org_id": org_id, "user_id": data.user_id, "role": data.org_role},
        db,
    )
    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/{org_id}/members/{user_id}")
def revoke_membership(
    org_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    membership = OrganizationMembership(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=user_id,
        membership_type="explicit_revocation",
        granted_at=datetime.now(timezone.utc),
        granted_by=current_user.id,
    )
    db.add(membership)
    log_audit_event(
        AuditEvents.ORG_MEMBERSHIP_REVOKED,
        current_user.id,
        membership.id,
        {"org_id": org_id, "user_id": user_id},
        db,
    )
    db.commit()
    return Response(status_code=204)


@router.get("/{org_id}/rules", response_model=list[OrgMembershipRuleResponse])
def list_rules(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    return (
        db.query(OrganizationMembershipRule)
        .filter(OrganizationMembershipRule.org_id == org_id)
        .all()
    )


@router.post("/{org_id}/rules", response_model=OrgMembershipRuleResponse)
def create_rule(
    org_id: str,
    data: OrgMembershipRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    rule = OrganizationMembershipRule(
        id=str(uuid.uuid4()),
        org_id=org_id,
        rule_type=data.rule_type,
        rule_value=data.rule_value,
        rule_group=data.rule_group,
    )
    db.add(rule)
    log_audit_event(
        AuditEvents.ORG_RULE_CREATED,
        current_user.id,
        rule.id,
        {"org_id": org_id, "rule_type": data.rule_type},
        db,
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{org_id}/rules/{rule_id}")
def delete_rule(
    org_id: str,
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_org_role(db, current_user, org_id, [OrgRole.ADMIN.value])
    rule = (
        db.query(OrganizationMembershipRule)
        .filter(
            OrganizationMembershipRule.id == rule_id,
            OrganizationMembershipRule.org_id == org_id,
        )
        .first()
    )
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    log_audit_event(
        AuditEvents.ORG_RULE_DELETED,
        current_user.id,
        rule_id,
        {"org_id": org_id, "rule_type": rule.rule_type},
        db,
    )
    db.delete(rule)
    db.commit()
    return Response(status_code=204)
