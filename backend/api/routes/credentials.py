import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import CredentialCreate, CredentialResponse, CredentialUpdate
from db.database import Credential, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=list[CredentialResponse])
def get_all_credentials(db: Session = Depends(get_db)):
    credentials = db.query(Credential).all()
    return credentials


@router.get("/by-user/{user_id}", response_model=list[CredentialResponse])
def get_all_credentials_by_user(user_id: str, db: Session = Depends(get_db)):
    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    return credentials


@router.get("/{credential_id}", response_model=CredentialResponse)
def get_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIAL_NOT_FOUND
        )
    return credential


# Credentials can only be created via registration endpoint
@router.post("/", response_model=CredentialResponse)
def create_credential(credential_data: CredentialCreate, db: Session = Depends(get_db)):
    return {"message": "Credentials can only be created via registration endpoint"}
    user = db.query(User).filter(User.id == credential_data.user_id).first()
    if user is None:
        return {"message": "Error adding credential: user not found"}
    new_uuid = str(uuid.uuid4())
    while True:
        credential = db.query(Credential).filter(Credential.id == new_uuid).first()
        if credential is None:
            break
        new_uuid = str(uuid.uuid4())
    new_credential = Credential(
        id=new_uuid,
        user_id=credential_data.user_id,
        public_key=credential_data.public_key,
        credential_id=credential_data.credential_id,
        sign_count=0,
        registered_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(new_credential)
    db.commit()
    db.refresh(new_credential)
    logger.info(
        f"Added credential for user {new_credential.user_id} (ID: {new_credential.id})"
    )
    return new_credential


@router.put("/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: str, updated_data: CredentialUpdate, db: Session = Depends(get_db)
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        return {"message": "Credential not found"}
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(credential, key, value)
    db.commit()
    logger.info(f"Edited credential: {credential.credential_id} (ID: {credential.id})")
    return credential


@router.delete("/{credential_id}")
def delete_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIAL_NOT_FOUND
        )
    db.delete(credential)
    db.commit()
    return {"message": Messages.CREDENTIAL_DELETED}
