import logging

from api.messages import Messages
from api.schemas import CredentialResponse, CredentialUpdate
from api.services.session_service import require_role
from db.database import Credential, User, get_db
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


# Credentials can only be created via registration endpoint
@router.post("/")
def create_credential():
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Credentials can only be created via the registration endpoint",
    )
    # user = db.query(User).filter(User.id == credential_data.user_id).first()
    # if user is None:
    #     return {"message": "Error adding credential: user not found"}
    # new_uuid = str(uuid.uuid4())
    # while True:
    #     credential = db.query(Credential).filter(Credential.id == new_uuid).first()
    #     if credential is None:
    #         break
    #     new_uuid = str(uuid.uuid4())
    # new_credential = Credential(
    #     id=new_uuid,
    #     user_id=credential_data.user_id,
    #     public_key=credential_data.public_key,
    #     credential_id=credential_data.credential_id,
    #     sign_count=0,
    #     registered_at=datetime.datetime.now(datetime.timezone.utc),
    # )
    # db.add(new_credential)
    # db.commit()
    # db.refresh(new_credential)
    # logger.info(
    #     f"Added credential for user {new_credential.user_id} (ID: {new_credential.id})"
    # )
    # return new_credential


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
    logger.info(f"Edited credential: {credential.credential_id} (ID: {credential.id})")
    return credential


@router.delete("/{credential_id}")
def delete_credential(
    credential_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )
    db.delete(credential)
    db.commit()
    return Response(status_code=204)
