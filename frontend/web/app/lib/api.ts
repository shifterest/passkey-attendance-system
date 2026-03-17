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
};

export type UserExtendedDto = {
	id: string;
	full_name: string;
	role: string;
	ongoing_class: string | null;
	in_class: boolean;
	school_id: string | null;
	email: string;
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
	network_anomaly: boolean;
	gps_is_mock: boolean;
	gps_in_geofence: boolean | null;
	timestamp: string;
	verification_methods: string[];
	assurance_score: number;
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
		play_integrity_enabled: boolean;
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
	start_time: string;
	end_time: string;
	status: string;
	dynamic_token: string;
	present_cutoff_minutes: number;
	late_cutoff_minutes: number;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const apiOrigin = getApiOrigin();
	if (!apiOrigin) throw new Error(ErrorMessages.apiOriginNotSet);
	const requestInit: RequestInit | undefined =
		// Same browser check!
		typeof window === "undefined"
			? // no-store ensures data freshness so that any server requests are up to date
				{ ...init, cache: (init?.cache ?? "no-store") as RequestCache }
			: init;
	const res = await fetch(`${apiOrigin}${path}`, requestInit);
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
	return res.json() as Promise<T>;
}

export function getBootstrapOperator() {
	return request<UserDto>(ApiPaths.bootstrapOperator, { method: "POST" });
}

export function getUser(userId: string) {
	return request<UserExtendedDto>(ApiPaths.user(userId));
}

export function getUsers(role?: string) {
	const qs = role ? `?role=${encodeURIComponent(role)}` : "";
	return request<UserDto[]>(`${ApiPaths.users}${qs}`);
}

export function getStudents() {
	return request<UserExtendedDto[]>(ApiPaths.students);
}

export function registerUser(userId: string) {
	return request<RegistrationSessionDto>(ApiPaths.adminRegister(userId), {
		method: "POST",
	});
}

export function unregisterUser(userId: string) {
	return request(ApiPaths.adminUnregister(userId), { method: "POST" });
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

export function getSessions(params?: { limit?: number; offset?: number }) {
	const q = new URLSearchParams();
	if (params?.limit !== undefined) q.set("limit", String(params.limit));
	if (params?.offset !== undefined) q.set("offset", String(params.offset));
	const qs = q.toString();
	return request<CheckInSessionDto[]>(`${ApiPaths.sessions}${qs ? `?${qs}` : ""}`);
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
	return request<AttendanceRecordDto[]>(`${ApiPaths.records}${qs ? `?${qs}` : ""}`);
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
	return request<AuditEventDto[]>(`${ApiPaths.auditEvents}${qs ? `?${qs}` : ""}`);
}

export function getUsers() {
	return request<UserDto[]>(ApiPaths.users);
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
	const origin = typeof window === "undefined" ? SERVER_API_ORIGIN : CLIENT_API_ORIGIN;
	return `${origin}${ApiPaths.auditExport}${qs ? `?${qs}` : ""}`;
}
