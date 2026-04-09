import { ApiPaths, ErrorMessages } from "./strings";

const CLIENT_API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN;
const SERVER_API_ORIGIN = process.env.API_ORIGIN_SERVER ?? CLIENT_API_ORIGIN;

// window only exists if this function is called in the browser
// That means that getApiOrigin will return SERVER_API_ORIGIN when called outside one
// We learn something new every day
function getApiOrigin() {
	return typeof window === "undefined" ? SERVER_API_ORIGIN : CLIENT_API_ORIGIN;
}

export type UserDto = {
	id: string;
	role: string;
	full_name: string;
	email: string;
	school_id: string | null;
	program: string | null;
	year_level: number | null;
};

export type UserExtendedDto = {
	id: string;
	full_name: string;
	role: string;
	ongoing_class: string | null;
	in_class: boolean;
	school_id: string | null;
	email: string;
	program: string | null;
	year_level: number | null;
	records: number;
	flagged: number;
	enrollments: number;
	registered: boolean;
};

export type ClassDto = {
	id: string;
	teacher_id: string | null;
	course_code: string;
	course_name: string;
	schedule: {
		days: string[];
		start_time: string;
		end_time: string;
	}[];
	standard_assurance_threshold: number;
	high_assurance_threshold: number;
};

export type AttendanceRecordDto = {
	id: string;
	session_id: string;
	user_id: string;
	is_flagged: boolean;
	flag_reason: string | null;
	manually_approved: boolean;
	manually_approved_by: string | null;
	manually_approved_reason: string | null;
	sync_pending: boolean;
	sync_escalated: boolean;
	network_anomaly: boolean;
	gps_is_mock: boolean;
	gps_in_geofence: boolean | null;
	timestamp: string;
	verification_methods: string[];
	assurance_score: number;
	assurance_band_recorded: string | null;
	standard_threshold_recorded: number | null;
	high_threshold_recorded: number | null;
	status: string;
};

export type TeacherDto = {
	id: string;
	role: string;
	full_name: string;
	email: string;
	school_id: string | null;
	class_count: number;
	student_count: number;
	has_open_session: boolean;
	default_policy: {
		id: string;
		class_id: string | null;
		standard_assurance_threshold: number;
		high_assurance_threshold: number;
		present_cutoff_minutes: number;
		late_cutoff_minutes: number;
		max_check_ins: number;
		created_by: string | null;
	} | null;
};

export type CheckInSessionDto = {
	id: string;
	class_id: string;
	event_id: string | null;
	start_time: string;
	end_time: string;
	status: string;
	present_cutoff_minutes: number;
	late_cutoff_minutes: number;
};

export type ClassEnrollmentDto = {
	id: string;
	class_id: string;
	student_id: string;
	expires_at: string | null;
};

export type AuditEventDto = {
	id: string;
	event_type: string;
	actor_id: string | null;
	target_id: string | null;
	detail: Record<string, unknown>;
	created_at: string;
};

export type RegistrationSessionDto = {
	user_id: string;
	registration_token: string;
	expires_in: number;
	url: string;
};

export type LoginSessionDto = {
	user_id: string;
	session_token: string;
	created_at: string;
	expires_at: string;
	expires_in: number;
};

function setSessionCookie(sessionToken: string, expiresIn: number) {
	document.cookie = `session_token=${encodeURIComponent(sessionToken)}; path=/; max-age=${expiresIn}; samesite=lax`;
}

export function persistBrowserSession(session: LoginSessionDto) {
	if (typeof window === "undefined") return;
	localStorage.setItem("user_id", session.user_id);
	localStorage.setItem("session_token", session.session_token);
	localStorage.setItem("expires_in", String(session.expires_in));
	setSessionCookie(session.session_token, session.expires_in);
}

export function clearBrowserSession() {
	if (typeof window === "undefined") return;
	localStorage.removeItem("user_id");
	localStorage.removeItem("session_token");
	localStorage.removeItem("expires_in");
	document.cookie = "session_token=; path=/; max-age=0; samesite=lax";
}

async function getSessionToken() {
	if (typeof window !== "undefined") {
		return window.localStorage.getItem("session_token");
	}
	const { cookies } = await import("next/headers");
	const cookieStore = await cookies();
	return cookieStore.get("session_token")?.value ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const apiOrigin = getApiOrigin();
	if (!apiOrigin) throw new Error(ErrorMessages.apiOriginNotSet);
	const headers = new Headers(init?.headers);
	const sessionToken = await getSessionToken();
	if (sessionToken) {
		headers.set("X-Session-Token", sessionToken);
	}
	const requestInit: RequestInit | undefined =
		// Same browser check!
		typeof window === "undefined"
			? // no-store ensures data freshness so that any server requests are up to date
				{ ...init, headers, cache: (init?.cache ?? "no-store") as RequestCache }
			: { ...init, headers };
	const res = await fetch(`${apiOrigin}${path}`, requestInit);
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

async function requestAll<T>(
	pathFactory: (offset: number, limit: number) => string,
	pageSize = 500,
) {
	const results: T[] = [];
	let offset = 0;
	while (true) {
		const page = await request<T[]>(pathFactory(offset, pageSize));
		results.push(...page);
		if (page.length < pageSize) break;
		offset += page.length;
	}
	return results;
}

export type BootstrapStatusDto = {
	phase: "disabled" | "ready" | "pending_registration" | "completed";
	registration_url?: string;
};

export type WebLoginInitiateDto = {
	token: string;
	url: string;
	ttl: number;
	poll_interval: number;
};

export type WebLoginPollDto = {
	status: "pending" | "completed" | "consumed";
	session: LoginSessionDto | null;
};

export function getBootstrapStatus() {
	return request<BootstrapStatusDto>(ApiPaths.bootstrapStatus);
}

export function bootstrapOperator(bootstrapToken: string) {
	return request<{ registration_url: string }>(ApiPaths.bootstrapOperator, {
		method: "POST",
		headers: {
			"X-Bootstrap-Token": bootstrapToken,
		},
	});
}

export function webLoginInitiate() {
	return request<WebLoginInitiateDto>(ApiPaths.webLoginInitiate, {
		method: "POST",
	});
}

export function webLoginPoll(token: string) {
	return request<WebLoginPollDto>(ApiPaths.webLoginPoll(token));
}

export function getUser(userId: string) {
	return request<UserDto>(ApiPaths.user(userId));
}

export function getUsers(role?: string) {
	const qs = role ? `?role=${encodeURIComponent(role)}` : "";
	return request<UserDto[]>(`${ApiPaths.users}${qs}`);
}

export function getStudents() {
	return request<UserExtendedDto[]>(ApiPaths.students);
}

export function getStudent(studentId: string) {
	return request<UserExtendedDto>(ApiPaths.student(studentId));
}

export function registerUser(userId: string) {
	return request<RegistrationSessionDto>(ApiPaths.adminRegister(userId), {
		method: "POST",
	});
}

export function unregisterUser(userId: string) {
	return request(ApiPaths.adminUnregister(userId), { method: "POST" });
}

export function createUser(data: {
	role: string;
	full_name: string;
	email: string;
	school_id?: string | null;
	program?: string | null;
	year_level?: number | null;
}) {
	return request<UserDto>(ApiPaths.users, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export type ImportUsersResult = {
	dry_run: boolean;
	created: number;
	skipped: number;
	errors: { row: number; reason: string; data: Record<string, string> }[];
};

export async function importUsers(
	file: File,
	format: "generic" | "banner" = "generic",
	dryRun = false,
): Promise<ImportUsersResult> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("format", format);
	formData.append("dry_run", String(dryRun));
	return request<ImportUsersResult>(ApiPaths.adminImportUsers, {
		method: "POST",
		body: formData,
	});
}

export function getTeachers() {
	return request<TeacherDto[]>(ApiPaths.teachers);
}

export function getClasses() {
	return request<ClassDto[]>(ApiPaths.classes);
}

export function getClass(classId: string) {
	return request<ClassDto>(ApiPaths.class(classId));
}

export function createClass(data: {
	teacher_id: string;
	course_code: string;
	course_name: string;
	schedule: { days: string[]; start_time: string; end_time: string }[];
	standard_assurance_threshold?: number;
	high_assurance_threshold?: number;
}) {
	return request<ClassDto>(ApiPaths.classes, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function getEnrollments() {
	return request<ClassEnrollmentDto[]>(ApiPaths.enrollments);
}

export function getEnrollmentsByClass(classId: string) {
	return request<ClassEnrollmentDto[]>(`/enrollments/by-class/${classId}`);
}

export function getEnrollmentsByStudent(studentId: string) {
	return request<ClassEnrollmentDto[]>(`/enrollments/by-student/${studentId}`);
}

export function createEnrollment(payload: {
	class_id: string;
	student_id: string;
}) {
	return request<ClassEnrollmentDto>(ApiPaths.enrollments, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}

export function deleteEnrollment(enrollmentId: string) {
	return request<void>(ApiPaths.enrollment(enrollmentId), {
		method: "DELETE",
	});
}

export function getSessions(params?: { limit?: number; offset?: number }) {
	const q = new URLSearchParams();
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	const qs = q.toString();
	return request<CheckInSessionDto[]>(
		`${ApiPaths.sessions}${qs ? `?${qs}` : ""}`,
	);
}

export function getAllSessions() {
	return requestAll<CheckInSessionDto>(
		(offset, limit) => `${ApiPaths.sessions}?limit=${limit}&offset=${offset}`,
		200,
	);
}

export function getSessionsByClass(
	classId: string,
	params?: { limit?: number; offset?: number; order?: string },
) {
	const q = new URLSearchParams();
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	if (params?.order) q.set("order", params.order);
	const qs = q.toString();
	return request<CheckInSessionDto[]>(
		`${ApiPaths.sessionsByClass(classId)}${qs ? `?${qs}` : ""}`,
	);
}

export function getSession(sessionId: string) {
	return request<CheckInSessionDto>(ApiPaths.session(sessionId));
}

export function getRecords(params?: { limit?: number; offset?: number }) {
	const q = new URLSearchParams();
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	const qs = q.toString();
	return request<AttendanceRecordDto[]>(
		`${ApiPaths.records}${qs ? `?${qs}` : ""}`,
	);
}

export function getAllRecords() {
	return requestAll<AttendanceRecordDto>(
		(offset, limit) => `${ApiPaths.records}?limit=${limit}&offset=${offset}`,
		500,
	);
}

export function getRecordsBySession(
	sessionId: string,
	params?: {
		canonical?: boolean;
		limit?: number;
		offset?: number;
		sort_by?: string;
		order?: string;
	},
) {
	const q = new URLSearchParams();
	if (params?.canonical !== undefined)
		q.set("canonical", String(params.canonical));
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	if (params?.sort_by) q.set("sort_by", params.sort_by);
	if (params?.order) q.set("order", params.order);
	const qs = q.toString();
	return request<AttendanceRecordDto[]>(
		`${ApiPaths.recordsBySession(sessionId)}${qs ? `?${qs}` : ""}`,
	);
}

export function getAuditEvents(params?: {
	limit?: number;
	offset?: number;
	event_type?: string;
	actor_id?: string;
	target_id?: string;
	start_at?: string;
	end_at?: string;
}) {
	const q = new URLSearchParams();
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	if (params?.event_type) q.set("event_type", params.event_type);
	if (params?.actor_id) q.set("actor_id", params.actor_id);
	if (params?.target_id) q.set("target_id", params.target_id);
	if (params?.start_at) q.set("start_at", params.start_at);
	if (params?.end_at) q.set("end_at", params.end_at);
	const qs = q.toString();
	return request<AuditEventDto[]>(
		`${ApiPaths.auditEvents}${qs ? `?${qs}` : ""}`,
	);
}

export function closeSession(sessionId: string) {
	return request<CheckInSessionDto>(ApiPaths.closeSession(sessionId), {
		method: "POST",
	});
}

export function approveRecord(recordId: string, reason?: string) {
	return request<AttendanceRecordDto>(ApiPaths.manualApproval(recordId), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ reason }),
	});
}

export function createManualRecord(payload: {
	session_id: string;
	student_id: string;
	reason: string;
	backdated_timestamp?: string;
	status?: string;
}) {
	return request<AttendanceRecordDto>(ApiPaths.manualRecord, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}

export function logout(userId: string, sessionToken: string) {
	return request<void>("/auth/logout", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ user_id: userId, session_token: sessionToken }),
	});
}

export function getAuditExportUrl(params?: {
	event_type?: string;
	actor_id?: string;
	target_id?: string;
	start_at?: string;
	end_at?: string;
}): string {
	const q = new URLSearchParams();
	if (params?.event_type) q.set("event_type", params.event_type);
	if (params?.actor_id) q.set("actor_id", params.actor_id);
	if (params?.target_id) q.set("target_id", params.target_id);
	if (params?.start_at) q.set("start_at", params.start_at);
	if (params?.end_at) q.set("end_at", params.end_at);
	const qs = q.toString();
	const origin = getApiOrigin();
	return `${origin}${ApiPaths.auditExport}${qs ? `?${qs}` : ""}`;
}

export type ClassPolicyDto = {
	id: string;
	class_id: string | null;
	created_by: string | null;
	standard_assurance_threshold: number;
	high_assurance_threshold: number;
	present_cutoff_minutes: number;
	late_cutoff_minutes: number;
	max_check_ins: number;
};

export function openSession(
	teacherId: string,
	opts?: { presentCutoffMinutes?: number; lateCutoffMinutes?: number },
) {
	return request<CheckInSessionDto>(ApiPaths.openSession, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			teacher_id: teacherId,
			...(opts?.presentCutoffMinutes !== undefined && {
				present_cutoff_minutes: opts.presentCutoffMinutes,
			}),
			...(opts?.lateCutoffMinutes !== undefined && {
				late_cutoff_minutes: opts.lateCutoffMinutes,
			}),
		}),
	});
}

export function updateRecord(
	recordId: string,
	data: {
		is_flagged?: boolean | null;
		flag_reason?: string | null;
		sync_pending?: boolean | null;
	},
) {
	return request<AttendanceRecordDto>(ApiPaths.record(recordId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function getPolicies() {
	return request<ClassPolicyDto[]>(ApiPaths.policies);
}

export function getPoliciesByUser(userId: string) {
	return request<ClassPolicyDto[]>(ApiPaths.userPolicy(userId));
}

export function createPolicy(data: {
	class_id?: string | null;
	standard_assurance_threshold?: number;
	high_assurance_threshold?: number;
	present_cutoff_minutes?: number;
	late_cutoff_minutes?: number;
	max_check_ins?: number;
}) {
	return request<ClassPolicyDto>(ApiPaths.policies, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function updatePolicy(
	policyId: string,
	data: {
		standard_assurance_threshold?: number | null;
		high_assurance_threshold?: number | null;
		present_cutoff_minutes?: number | null;
		late_cutoff_minutes?: number | null;
		max_check_ins?: number | null;
	},
) {
	return request<ClassPolicyDto>(ApiPaths.policy(policyId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function deletePolicy(policyId: string) {
	return request<void>(ApiPaths.policy(policyId), { method: "DELETE" });
}

// Credentials

export type CredentialDto = {
	id: string;
	user_id: string;
	device_public_key: string;
	public_key: string;
	credential_id: string;
	sign_count: number;
	key_security_level: string | null;
	attestation_cert_serial: string | null;
	registered_at: string;
	sign_count_anomaly: boolean;
};

export function getCredentials(userId: string) {
	return request<CredentialDto[]>(
		`${ApiPaths.credentials}?user_id=${encodeURIComponent(userId)}`,
	);
}

export function revokeCredential(credentialId: string) {
	return request<void>(ApiPaths.credential(credentialId), {
		method: "DELETE",
	});
}

// Offline sync

export function offlineSync(body: {
	class_id: string;
	session_id?: string;
	opened_at: string;
	closed_at: string;
	nonce_set: string[];
	records: Record<string, unknown>[];
}) {
	return request<unknown>(ApiPaths.offlineSync, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

// Organizations

export type OrgDto = {
	id: string;
	name: string;
	description: string | null;
	created_at: string;
};

export type OrgMemberDto = {
	id: string;
	org_id: string;
	user_id: string;
	membership_type: string;
	org_role: string | null;
	expires_at: string | null;
	granted_at: string;
	granted_by: string | null;
};

export type OrgRuleDto = {
	id: string;
	org_id: string;
	rule_type: string;
	rule_value: string | null;
	rule_group: number | null;
};

export function getOrgs() {
	return request<OrgDto[]>(ApiPaths.orgs);
}

export function createOrg(data: { name: string; description?: string }) {
	return request<OrgDto>(ApiPaths.orgs, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function updateOrg(
	orgId: string,
	data: { name?: string; description?: string },
) {
	return request<OrgDto>(ApiPaths.org(orgId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function deleteOrg(orgId: string) {
	return request<void>(ApiPaths.org(orgId), { method: "DELETE" });
}

export function getOrgMembers(orgId: string) {
	return request<OrgMemberDto[]>(ApiPaths.orgMembers(orgId));
}

export function grantMembership(
	orgId: string,
	data: {
		user_id: string;
		membership_type: string;
		org_role?: string;
		expires_at?: string;
	},
) {
	return request<OrgMemberDto>(ApiPaths.orgMembers(orgId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function revokeMembership(orgId: string, userId: string) {
	return request<void>(ApiPaths.orgMember(orgId, userId), {
		method: "DELETE",
	});
}

export function getOrgRules(orgId: string) {
	return request<OrgRuleDto[]>(ApiPaths.orgRules(orgId));
}

export function createOrgRule(
	orgId: string,
	data: { rule_type: string; rule_value: string },
) {
	return request<OrgRuleDto>(ApiPaths.orgRules(orgId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function deleteOrgRule(orgId: string, ruleId: string) {
	return request<void>(ApiPaths.orgRule(orgId, ruleId), { method: "DELETE" });
}

// Events

export type EventDto = {
	id: string;
	org_id: string;
	name: string;
	description: string | null;
	schedule: Record<string, unknown>[];
	standard_assurance_threshold: number;
	high_assurance_threshold: number;
	play_integrity_enabled: boolean;
	max_check_ins: number;
	created_by: string | null;
	created_at: string;
};

export type EventRuleDto = {
	id: string;
	event_id: string;
	rule_type: string;
	rule_value: string | null;
	rule_group: number | null;
};

export function getEvents(orgId: string) {
	return request<EventDto[]>(ApiPaths.orgEvents(orgId));
}

export function createEvent(
	orgId: string,
	data: {
		name: string;
		description?: string;
		schedule?: Record<string, unknown>[];
		standard_assurance_threshold?: number;
		high_assurance_threshold?: number;
		play_integrity_enabled?: boolean;
		max_check_ins?: number;
	},
) {
	return request<EventDto>(ApiPaths.orgEvents(orgId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function updateEvent(
	eventId: string,
	data: {
		name?: string;
		description?: string;
		schedule?: Record<string, unknown>[];
		standard_assurance_threshold?: number;
		high_assurance_threshold?: number;
		play_integrity_enabled?: boolean;
		max_check_ins?: number;
	},
) {
	return request<EventDto>(ApiPaths.event(eventId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function deleteEvent(eventId: string) {
	return request<void>(ApiPaths.event(eventId), { method: "DELETE" });
}

export function getEventRules(eventId: string) {
	return request<EventRuleDto[]>(ApiPaths.eventRules(eventId));
}

export function createEventRule(
	eventId: string,
	data: { rule_type: string; rule_value: string },
) {
	return request<EventRuleDto>(ApiPaths.eventRules(eventId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export function deleteEventRule(eventId: string, ruleId: string) {
	return request<void>(ApiPaths.eventRule(eventId, ruleId), {
		method: "DELETE",
	});
}
