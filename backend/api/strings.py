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
    CREDENTIAL_CREATE_FORBIDDEN = (
        "Credentials can only be created via the registration endpoint"
    )

    # Classes
    CLASS_NOT_FOUND = "Class not found"
    CLASS_TEACHER_NOT_FOUND = "Error adding class: teacher not found"
    CLASS_TEACHER_INVALID_ROLE = "Invalid teacher role"
    CLASS_DELETED = "Class deleted"

    # Class policies
    CLASS_POLICY_NOT_FOUND = "Class policy not found"
    CLASS_POLICY_DELETED = "Class policy deleted"
    CLASS_POLICY_FORBIDDEN = "You do not have permission to modify this policy"
    CLASS_POLICY_DUPLICATE = "A policy for this scope already exists"

    # Class enrollments
    ENROLLMENT_NOT_FOUND = "Enrollment not found"
    ENROLLMENT_ALREADY_EXISTS = "Student is already enrolled in this class"
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
    SESSION_ALREADY_CLOSED = "Session is already closed"
    SESSION_DELETED = "Session deleted"
    SESSION_CREATE_FORBIDDEN = (
        "Sessions can only be opened through the teacher session open endpoint"
    )

    # Attendance records
    RECORD_NOT_FOUND = "Record not found"
    RECORD_DELETED = "Record deleted"
    RECORD_APPROVED = "Record approved"
    STUDENT_NOT_ENROLLED = "Student is not enrolled in this class"
    RECORD_CREATE_FORBIDDEN = (
        "Records can only be created via the authentication verify endpoint"
    )

    # Audit events
    AUDIT_EVENT_NOT_FOUND = "Audit event not found"
    AUDIT_INVALID_TIME_RANGE = "Invalid audit time range"

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
    BLE_TOKEN_RATE_LIMITED = "BLE token polling rate limit exceeded"
    DEVICE_PAYLOAD_STALE = "Authentication request has expired. Please try again."
    CHECKIN_RETRY_LIMIT_REACHED = "Check-in attempt limit reached for this session."
    AUTH_RATE_LIMITED = "Too many authentication attempts. Try again later."
    DEVICE_KEY_INSECURE = (
        "Registration requires a trusted Android hardware-backed device key "
        "(StrongBox or TEE)"
    )

    # Play Integrity
    PLAY_INTEGRITY_DISABLED = "Play Integrity is not enabled for this deployment"
    PLAY_INTEGRITY_RATE_LIMITED = "Play Integrity vouch limit reached for today"
    PLAY_INTEGRITY_VERIFY_FAILED = "Play Integrity verification failed"
    PLAY_INTEGRITY_UNAVAILABLE = "Play Integrity service is currently unavailable"
    PLAY_INTEGRITY_VERDICT_FAILED = (
        "Device integrity verdict does not meet requirements"
    )
    PLAY_INTEGRITY_NONCE_INVALID = "Play Integrity nonce mismatch"

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

    # Internal validation errors
    ATTESTATION_CERT_CHAIN_MISSING = (
        "Android Key attestation certificate chain is missing"
    )
    ATTESTATION_CERT_CHAIN_INVALID = (
        "Android Key attestation certificate chain is invalid"
    )
    ATTESTATION_CRL_REVOKED = "Device attestation key has been revoked by Google"
    ATTESTATION_EXTENSION_UNEXPECTED_FORMAT = (
        "Android Key attestation extension has unexpected format"
    )
    ATTESTATION_EXTENSION_TRAILING_DATA = (
        "Android Key attestation extension contains trailing data"
    )
    ATTESTATION_EXTENSION_MISSING = "Android Key attestation extension is missing"
    ATTESTATION_ANDROID_KEY_REQUIRED = "Registration must use Android Key attestation"
    ATTESTATION_ROOT_NOT_TRUSTED = "Android Key attestation root is not trusted"
    ATTESTATION_SECURITY_LEVEL_MISSING = (
        "Android Key attestation security level is missing"
    )
    ATTESTATION_NOT_HARDWARE_BACKED = "Android Key attestation is not hardware-backed"
    DEVICE_BINDING_PAYLOAD_KEYS_INVALID = "Invalid device binding payload keys"
    DEVICE_KEY_ALGORITHM_INVALID = "Invalid key algorithm"
    SCHEDULE_DAYS_DUPLICATE = "Duplicate schedule days are not allowed"
    SCHEDULE_END_TIME_INVALID = "end_time must be later than start_time"


class Logs:
    # Users
    USER_ADDED = "Added user: {full_name} (ID: {user_id})"
    USER_EDITED = "Updated user: {full_name} (ID: {user_id})"

    # Classes
    CLASS_ADDED = "Added class: {course_name} (Code: {course_code})"
    CLASS_EDITED = "Updated class: {course_name} (Code: {course_code})"

    # Class policies
    CLASS_POLICY_ADDED = "Added class policy: {policy_id}"
    CLASS_POLICY_EDITED = "Updated class policy: {policy_id}"
    CLASS_POLICY_ASSIGNED = "Assigned policy {policy_id} to class {class_id}"
    USER_POLICY_ASSIGNED = "Updated default policy for user: {user_id}"

    # Class enrollments
    ENROLLMENT_ADDED = "Added enrollment: student {student_name} in class {class_name} (ID: {enrollment_id})"
    ENROLLMENT_EDITED = "Updated enrollment: {enrollment_id}"

    # Attendance sessions
    BLE_TOKEN_MISMATCH = "BLE token mismatch or absent for user {user_id} on session {session_id} — BLE score not applied"
    BLE_TOKEN_ROTATED = "BLE token rotated for session {session_id}"
    SESSION_ADDED = "Added session: {session_id}"
    SESSION_EDITED = "Updated session: {session_id}"
    SESSION_CLOSED = "Session {session_id} closed by user {user_id}"
    SESSION_TIMEZONE_MISMATCH = (
        "Teacher {teacher_id} client timezone offset {client_offset} differs "
        "from server timezone {server_timezone} by {diff_minutes:.0f} minutes"
    )

    # Attendance records
    RECORD_ADDED = "Added record: {record_id} for user {full_name} (ID: {user_id})"
    RECORD_EDITED = "Updated record: {record_id}"
    RECORD_APPROVED = "Record {record_id} manually approved by user {user_id}"
    MANUAL_RECORD_CREATED = "Manual attendance record {record_id} created for user {user_id} by user {performed_by_user_id}"

    # Audit events
    AUDIT_EVENT_LOGGED = (
        "Audit event: {event_type} (actor: {actor_id}, target: {target_id})"
    )

    # Registration and authentication
    USER_REGISTERED = (
        "User registered: added credential {credential_id} for user {user_id}"
    )
    CREDENTIAL_EDITED = "Edited credential: {credential_id} (ID: {credential_row_id})"
    LEGACY_ATTESTATION_ROOT_ACCEPTED = (
        "Legacy Android attestation root accepted for user_id={user_id} "
        "credential_id={credential_id} root_serial={root_serial_hex}"
    )
    CREDENTIAL_REVOKED = (
        "Credential {credential_id} revoked by user {performed_by_user_id}"
    )
    CREDENTIAL_CRL_VERIFIED = "CRL check passed for credential: {credential_id}"
    CREDENTIAL_CRL_REVOKED = "CRL check failed — credential revoked: {credential_id}"
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
    BOOTSTRAP_DENIED_DISABLED = "Bootstrap denied: disabled"
    BOOTSTRAP_DENIED_ALREADY_COMPLETED = "Bootstrap denied: already_completed"
    BOOTSTRAP_DENIED_ALREADY_INITIALIZED = "Bootstrap denied: already_initialized"
    BOOTSTRAP_TOKEN_ISSUED = "Bootstrap token issued"
    ADMIN_PROMOTED_TO_OPERATOR = (
        "Promoted admin to operator: {full_name} (ID: {user_id})"
    )
    OPERATOR_BOOTSTRAP_FAILED = "Failed to bootstrap operator: {error}"


class AuditEvents:
    BOOTSTRAP_ATTEMPT = "bootstrap_attempt"
    BOOTSTRAP_COMPLETED = "bootstrap_completed"
    CREDENTIAL_REVOKED = "credential_revoked"
    DEVICE_ATTESTATION_FAILURE = "device_attestation_failure"
    DEVICE_ATTESTATION_VERIFIED = "device_attestation_verified"
    DEVICE_KEY_MISMATCH = "device_key_mismatch"
    DEVICE_SIGNATURE_FAILURE = "device_signature_failure"
    ENROLLMENT_DELETED = "enrollment_deleted"
    MANUAL_APPROVAL = "manual_approval"
    MANUAL_ATTENDANCE = "manual_attendance"
    SIGN_COUNT_ANOMALY = "sign_count_anomaly"
    USER_UPDATED = "user_updated"
