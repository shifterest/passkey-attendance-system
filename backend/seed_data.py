# A vibecoded script to populate the database

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import Base, Class, ClassEnrollment, User, engine
from db.migrations import upgrade_database
from sqlalchemy.orm import Session

# Load data from JSON file
data_path = Path(__file__).parent / "data.json"
with open(data_path, "r") as f:
    data = json.load(f)

# Drop all existing tables
print("🗑️  Dropping existing tables...")
Base.metadata.drop_all(bind=engine)
with engine.begin() as connection:
    connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

# Recreate schema from Alembic baseline
print("📝 Applying Alembic migrations...")
upgrade_database()

# Populate database
with Session(engine) as session:
    # Load users
    users_data = data.get("users", [])
    for user_dict in users_data:
        user = User(
            id=str(user_dict["id"]),
            role=user_dict["role"].lower(),
            full_name=user_dict["full_name"],
            email=user_dict["email"],
            school_id=user_dict.get("school_id"),
        )
        session.add(user)
    session.flush()
    print(f"✓ Inserted {len(users_data)} users")

    # Load classes
    classes_data = data.get("classes", [])
    for class_dict in classes_data:
        class_obj = Class(
            id=str(class_dict["id"]),
            teacher_id=str(class_dict["teacher_id"]),
            course_code=class_dict["course_code"],
            course_name=class_dict["course_name"],
            schedule=class_dict.get("schedule", []),
        )
        session.add(class_obj)
    session.flush()
    print(f"✓ Inserted {len(classes_data)} classes")

    # Load enrollments
    enrollments_data = data.get("enrollments", [])
    for enrollment_dict in enrollments_data:
        enrollment = ClassEnrollment(
            id=str(enrollment_dict["id"]),
            class_id=str(enrollment_dict["class_id"]),
            student_id=str(enrollment_dict["student_id"]),
        )
        session.add(enrollment)
    session.flush()
    print(f"✓ Inserted {len(enrollments_data)} enrollments")

    session.commit()
    print("\n✅ Database seeded successfully!")
