import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db.database import Base, Class, ClassEnrollment, User, engine
from sqlalchemy.orm import Session

# Load data from separate JSON files
base_path = Path(__file__).parent


def load_json(filename):
    filepath = base_path / filename
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"⚠️  {filename} not found, skipping...")
        return []


users_data = load_json("users.json")
classes_data = load_json("classes.json")
enrollments_data = load_json("enrollments.json")

# Drop all existing tables
print("🗑️  Dropping existing tables...")
Base.metadata.drop_all(bind=engine)

# Create all tables fresh
print("📝 Creating tables...")
Base.metadata.create_all(engine)

# Populate database
with Session(engine) as session:
    # Load users
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
