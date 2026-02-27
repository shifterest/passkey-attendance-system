import logging

from api.messages import Logs, Messages
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/", tags=["root"])


@router.get("/")
def read_root():
    return {"tantan": "cutie"}


@router.get("/health")
def health_check():
    return {"status": "healthy"}
