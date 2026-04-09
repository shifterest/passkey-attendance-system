import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from api.config import settings
from api.services.auth_service import create_registration_session
from api.services.import_service import (
    process_class_import,
    process_enrollment_import,
    process_import,
    process_org_import,
)
from api.services.session_service import require_role
from api.strings import Logs, Messages
from database.connection import get_db
from database.models import Credential, RegistrationSession, User
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/register/{user_id}")
def register_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    new_session = RegistrationSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=settings.registration_timeout),
    )
    db.add(new_session)
    db.commit()

    response = create_registration_session(new_session)

    logger.info(
        Logs.REGISTER_SESSION_CREATED.format(full_name=user.full_name, user_id=user.id)
    )
    return response


@router.post("/unregister/{user_id}")
def unregister_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )

    for credential in credentials:
        db.delete(credential)
    db.commit()

    logger.info(
        Logs.USER_UNREGISTERED.format(full_name=user.full_name, user_id=user.id)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import-users")
async def import_users(
    file: Annotated[UploadFile, File()],
    format: Annotated[Literal["generic", "banner"], Form()] = "generic",
    dry_run: Annotated[bool, Form()] = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    content = await file.read()
    result = process_import(content=content, format=format, dry_run=dry_run, db=db)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"]
        )
    return result


@router.post("/import-classes")
async def import_classes(
    file: Annotated[UploadFile, File()],
    dry_run: Annotated[bool, Form()] = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    content = await file.read()
    result = process_class_import(content=content, dry_run=dry_run, db=db)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"]
        )
    return result


@router.post("/import-enrollments")
async def import_enrollments(
    file: Annotated[UploadFile, File()],
    dry_run: Annotated[bool, Form()] = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    content = await file.read()
    result = process_enrollment_import(content=content, dry_run=dry_run, db=db)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"]
        )
    return result


@router.post("/import-orgs")
async def import_orgs(
    file: Annotated[UploadFile, File()],
    dry_run: Annotated[bool, Form()] = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    content = await file.read()
    result = process_org_import(content=content, dry_run=dry_run, db=db)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"]
        )
    return result
