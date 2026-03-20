import logging

from api.schemas import (
    CredentialKeyDetail,
    CredentialResponse,
    CredentialRevokedDetail,
    CredentialUpdate,
)
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Credential, User
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=list[CredentialResponse])
def get_all_credentials(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    credentials = db.query(Credential).all()
    return credentials


@router.get("/by-user/{user_id}", response_model=list[CredentialResponse])
def get_all_credentials_by_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student", "admin", "operator")),
):
    if current_user.role == "student" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    return credentials


@router.get("/{credential_id}", response_model=CredentialResponse)
def get_credential(
    credential_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )
    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: str,
    updated_data: CredentialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(credential, key, value)
    db.commit()
    logger.info(
        Logs.CREDENTIAL_EDITED.format(
            credential_id=credential.credential_id,
            credential_row_id=credential.id,
        )
    )
    return credential


@router.delete("/{credential_id}")
def delete_credential(
    credential_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )
    target_user_id = credential.user_id
    old_credential_id = credential.credential_id
    old_key_security_level = credential.key_security_level
    db.delete(credential)
    db.commit()
    log_audit_event(
        event_type=AuditEvents.CREDENTIAL_REVOKED,
        actor_id=current_user.id,
        target_id=target_user_id,
        detail=CredentialRevokedDetail(
            credential_id=credential_id,
            old_value=CredentialKeyDetail(
                credential_id=old_credential_id,
                key_security_level=old_key_security_level,
            ),
        ).model_dump(),
        db=db,
    )
    logger.info(
        Logs.CREDENTIAL_REVOKED.format(
            credential_id=credential_id,
            performed_by_user_id=current_user.id,
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
