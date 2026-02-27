import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import UserCreate, UserResponse, UserUpdate
from db.database import User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    return user


@router.post("/", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    new_uuid = str(uuid.uuid4())
    while True:
        user = db.query(User).filter(User.id == new_uuid).first()
        if user is None:
            break
        new_uuid = str(uuid.uuid4())
    new_user = User(
        id=new_uuid,
        role=user_data.role,
        full_name=user_data.full_name,
        email=user_data.email,
        school_id=user_data.school_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(
        Logs.USER_ADDED.format(full_name=new_user.full_name, user_id=new_user.id)
    )
    return new_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, updated_data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    logger.info(Logs.USER_EDITED.format(full_name=user.full_name, user_id=user.id))
    return user


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    db.delete(user)
    db.commit()
    return {"message": Messages.USER_DELETED}
