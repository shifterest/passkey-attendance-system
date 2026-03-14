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
    SESSION_TEACHER_NOT_FOUND = "Teacher not found"
    SESSION_TEACHER_INVALID_ROLE = "Invalid teacher role"
    SESSION_NO_ACTIVE_SCHEDULE = "No scheduled class is active for this teacher"
    SESSION_AMBIGUOUS_ACTIVE_SCHEDULE = (
        "Multiple scheduled classes are active for this teacher"
    )
    SESSION_ALREADY_OPEN = "An attendance session is already open for this class"
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
    DEVICE_PAYLOAD_STALE = "Authentication request has expired. Please try again."
    CHECKIN_RETRY_LIMIT_REACHED = "Check-in attempt limit reached for this session."
    AUTH_RATE_LIMITED = "Too many authentication attempts. Try again later."

    # Play Integrity
    PLAY_INTEGRITY_DISABLED = "Play Integrity is not enabled for this deployment"
    PLAY_INTEGRITY_RATE_LIMITED = "Play Integrity vouch limit reached for today"
    PLAY_INTEGRITY_VERIFY_FAILED = "Play Integrity verification failed"
    PLAY_INTEGRITY_UNAVAILABLE = "Play Integrity service is currently unavailable"
    PLAY_INTEGRITY_VERDICT_FAILED = (
        "Device integrity verdict does not meet requirements"
    )

    # Session auth
    AUTH_SESSION_INVALID = "Session is invalid or expired"
    AUTH_FORBIDDEN = "Insufficient permissions"

    # Login/logout
    LOGIN_SESSION_NOT_FOUND = "Login session not found"
    SESSION_USER_MISMATCH = "Login session user mismatch"
    LOGOUT_SUCCESSFUL = "Logout successful"

    # Bootstrap
    BOOTSTRAP_DISABLED = "Bootstrap is disabled"
    BOOTSTRAP_ALREADY_COMPLETED = "Bootstrap has already been completed"
    BOOTSTRAP_TOKEN_REQUIRED = "Bootstrap token is required"
    BOOTSTRAP_TOKEN_INVALID = "Bootstrap token is invalid or expired"
    BOOTSTRAP_ALREADY_INITIALIZED = "Bootstrap already initialized"
    BOOTSTRAP_RATE_LIMITED = "Too many bootstrap attempts. Try again later."
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
    SESSION_TIMEZONE_MISMATCH = (
        "Teacher {teacher_id} client timezone offset {client_offset} differs "
        "from server timezone {server_timezone} by {diff_minutes:.0f} minutes"
    )

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

    # Play Integrity
    PLAY_INTEGRITY_VOUCH_ISSUED = (
        "Play Integrity vouch issued for credential: {credential_id}"
    )
    PLAY_INTEGRITY_VERDICT_FAILED = (
        "Play Integrity verdict failed for credential {credential_id}: {verdict}"
    )

    # Login/logout
    LOGIN_SUCCESSFUL = "Logged in user: {full_name} (ID: {user_id})"
    OPERATOR_CREATED = "Created operator: {user_id}"

    # Bootstrap
    BOOTSTRAP_ATTEMPT = "Bootstrap attempt received"
    BOOTSTRAP_COMPLETED = "Bootstrap completed"
    BOOTSTRAP_DENIED = "Bootstrap denied: {reason}"
    BOOTSTRAP_TOKEN_ISSUED = "Bootstrap token issued"
    ADMIN_PROMOTED_TO_OPERATOR = (
        "Promoted admin to operator: {full_name} (ID: {user_id})"
    )
    OPERATOR_BOOTSTRAP_FAILED = "Failed to bootstrap operator: {error}"
