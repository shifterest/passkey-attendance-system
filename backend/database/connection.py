from api.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

engine = create_engine(settings.database_url, echo=True)


class Base(DeclarativeBase):
    pass


session = sessionmaker(bind=engine)


def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()
