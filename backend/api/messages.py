# Centralized messages and logs since I have OCD lol


class Messages:
    # Users
    USER_NOT_FOUND = "User not found"
    USER_INVALID_ROLE = "Invalid role"
    USER_DELETED = "User deleted"
    USER_NOT_STUDENT = "User is not a student"

    # Credentials
    CREDENTIALS_NOT_FOUND = "Credentials not found"
    CREDENTIAL_DELETED = "User unregistered"
    CREDENTIAL_LIMIT_REACHED = "Maximum active credentials reached for user"

    # Classes
    CLASS_NOT_FOUND = "Class not found"
    CLASS_TEACHER_NOT_FOUND = "Error adding class: teacher not found"
    CLASS_TEACHER_INVALID_ROLE = "Invalid teacher role"
    CLASS_DELETED = "Class deleted"

    # Class enrollments
    ENROLLMENT_NOT_FOUND = "Enrollment not found"
    ENROLLMENT_CLASS_NOT_FOUND = "Class not found"
    ENROLLMENT_STUDENT_NOT_FOUND = "Student not found"
    ENROLLMENT_DELETED = "Enrollment deleted"

    # Attendance sessions
    SESSION_NOT_FOUND = "Session not found"
    SESSION_CLASS_NOT_FOUND = "Class not found"
    SESSION_DELETED = "Session deleted"

    # Attendance records
    RECORD_NOT_FOUND = "Record not found"
    RECORD_DELETED = "Record deleted"

    # Registration and authentication
    AUTH_NO_CREDENTIAL = "No credential found for user"
    AUTH_NO_PENDING = "No pending authentication"
    AUTH_VERIFY_FAILED = "Authentication verification failed"
    DEVICE_VERIFY_FAILED = "Device signature verification failed"
    DEVICE_PUBLIC_KEY_MISMATCH = "Device public key does not match enrolled credential"
    AUTH_CREDENTIAL_MISMATCH = "Credential does not match enrolled credentials"
    AUTH_VERIFY_INVALID_METHODS = "Invalid verification methods"
    AUTH_VERIFY_SESSION_NOT_FOUND = "Session not found"
    REGISTER_NO_PENDING = "No pending registration"
    REGISTER_VERIFY_FAILED = "Registration verification failed"
    REGISTRATION_TOKEN_INVALID = "Registration token is invalid or expired"
    REGISTRATION_TOKEN_USER_MISMATCH = "Registration token does not match user"
    INVALID_CHALLENGE_DATA = "Invalid challenge data"

    # Login/logout
    LOGIN_SESSION_NOT_FOUND = "Login session not found"
    SESSION_USER_MISMATCH = "Login session user mismatch"
    LOGOUT_SUCCESSFUL = "Logout successful"

    # Bootstrap
    OPERATOR_ALREADY_EXISTS = "Operator already exists"
    OPERATOR_BOOTSTRAP_FAILED = "Failed to bootstrap operator"


class Logs:
    # Users
    USER_ADDED = "Added user: {full_name} (ID: {user_id})"
    USER_EDITED = "Updated user: {full_name} (ID: {user_id})"

    # Classes
    CLASS_ADDED = "Added class: {course_name} (Code: {course_code})"
    CLASS_EDITED = "Updated class: {course_name} (Code: {course_code})"

    # Class enrollments
    ENROLLMENT_ADDED = "Added enrollment: student {student_name} in class {class_name} (ID: {enrollment_id})"
    ENROLLMENT_EDITED = "Updated enrollment: {enrollment_id}"

    # Attendance sessions
    SESSION_ADDED = "Added session: {session_id}"
    SESSION_EDITED = "Updated session: {session_id}"

    # Attendance records
    RECORD_ADDED = "Added record: {record_id} for user {full_name} (ID: {user_id})"
    RECORD_EDITED = "Updated record: {record_id}"

    # Registration and authentication
    USER_REGISTERED = (
        "User registered: added credential {credential_id} for user {user_id}"
    )
    REGISTER_VERIFY_FAILED = "Registration verification failed: {error}"
    AUTH_VERIFY_FAILED = "Authentication verification failed: {error}"
    REGISTER_SESSION_CREATED = (
        "Created registration session for user {full_name} (ID: {user_id})"
    )
    USER_UNREGISTERED = (
        "User unregistered: deleted credentials for user {full_name} (ID: {user_id})"
    )

    # Login/logout
    LOGIN_SUCCESSFUL = "Logged in user: {full_name} (ID: {user_id})"
    OPERATOR_CREATED = "Created operator: {user_id}"

    # Bootstrap
    ADMIN_PROMOTED_TO_OPERATOR = (
        "Promoted admin to operator: {full_name} (ID: {user_id})"
    )
    OPERATOR_BOOTSTRAP_FAILED = "Failed to bootstrap operator: {error}"
