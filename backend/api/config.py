import os
from dotenv import load_dotenv

load_dotenv()

RP_ID = os.getenv("RP_ID", "attendance.softeng.com")
RP_NAME = os.getenv("RP_NAME", "Passkey Attendance System")
ORIGIN = os.getenv("ORIGIN", "http://localhost:8000")
CHALLENGE_TIMEOUT = int(os.getenv("CHALLENGE_TIMEOUT", 180))
LOGIN_TIMEOUT = int(os.getenv("LOGIN_TIMEOUT", 1800))
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
