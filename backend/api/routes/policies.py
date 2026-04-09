import logging
import uuid

from api.schemas import ClassPolicyCreate, ClassPolicyResponse, ClassPolicyUpdate
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Class, ClassPolicy, User
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/policies", tags=["policies"])


def _assert_can_modify(policy: ClassPolicy, current_user: User) -> None:
    if current_user.role in ("admin", "operator"):
        return
    if policy.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=Messages.CLASS_POLICY_FORBIDDEN,
        )


@router.get("/", response_model=list[ClassPolicyResponse])
def get_all_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher":
        return (
            db.query(ClassPolicy)
            .filter(ClassPolicy.created_by == current_user.id)
            .all()
        )
    return db.query(ClassPolicy).all()


@router.get("/{policy_id}", response_model=ClassPolicyResponse)
def get_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    policy = db.query(ClassPolicy).filter(ClassPolicy.id == policy_id).first()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.CLASS_POLICY_NOT_FOUND,
        )
    if current_user.role == "teacher" and policy.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=Messages.CLASS_POLICY_FORBIDDEN,
        )
    return policy


@router.post("", response_model=ClassPolicyResponse)
def create_policy(
    policy_data: ClassPolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    created_by = current_user.id if current_user.role == "teacher" else None
    if policy_data.class_id is not None:
        target_class = db.query(Class).filter(Class.id == policy_data.class_id).first()
        if target_class is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.CLASS_NOT_FOUND,
            )
        if (
            current_user.role == "teacher"
            and target_class.teacher_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=Messages.CLASS_POLICY_FORBIDDEN,
            )
    existing = (
        db.query(ClassPolicy)
        .filter(
            ClassPolicy.created_by == created_by,
            ClassPolicy.class_id == policy_data.class_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.CLASS_POLICY_DUPLICATE,
        )
    new_policy = ClassPolicy(
        id=str(uuid.uuid4()),
        created_by=created_by,
        class_id=policy_data.class_id,
        standard_assurance_threshold=policy_data.standard_assurance_threshold,
        high_assurance_threshold=policy_data.high_assurance_threshold,
        present_cutoff_minutes=policy_data.present_cutoff_minutes,
        late_cutoff_minutes=policy_data.late_cutoff_minutes,
        max_check_ins=policy_data.max_check_ins,
    )
    db.add(new_policy)
    log_audit_event(
        AuditEvents.POLICY_CREATED,
        current_user.id,
        new_policy.id,
        {"class_id": policy_data.class_id},
        db,
    )
    db.commit()
    db.refresh(new_policy)
    logger.info(Logs.CLASS_POLICY_ADDED.format(policy_id=new_policy.id))
    return new_policy


@router.put("/{policy_id}", response_model=ClassPolicyResponse)
def update_policy(
    policy_id: str,
    updated_data: ClassPolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    policy = db.query(ClassPolicy).filter(ClassPolicy.id == policy_id).first()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.CLASS_POLICY_NOT_FOUND,
        )
    _assert_can_modify(policy, current_user)
    updated_fields = updated_data.model_dump(exclude_unset=True)
    for key, value in updated_fields.items():
        setattr(policy, key, value)
    log_audit_event(
        AuditEvents.POLICY_UPDATED,
        current_user.id,
        policy.id,
        {"updated_fields": list(updated_fields.keys())},
        db,
    )
    db.commit()
    logger.info(Logs.CLASS_POLICY_EDITED.format(policy_id=policy.id))
    return policy


@router.delete("/{policy_id}")
def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    policy = db.query(ClassPolicy).filter(ClassPolicy.id == policy_id).first()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.CLASS_POLICY_NOT_FOUND,
        )
    _assert_can_modify(policy, current_user)
    db.delete(policy)
    log_audit_event(
        AuditEvents.POLICY_DELETED,
        current_user.id,
        policy_id,
        {"class_id": policy.class_id},
        db,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
