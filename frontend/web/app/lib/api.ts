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
	schedule: Record<string, string>[];
};

export type AttendanceRecordDto = {
	session_id: string;
	user_id: string;
	is_flagged: boolean;
	flag_reason: string | null;
	timestamp: string;
	verification_methods: string[];
	status: string;
};

export type RegistrationSessionDto = {
	user_id: string;
	registration_token: string;
	expires_in: number;
	url: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const apiOrigin = getApiOrigin();
	if (!apiOrigin) throw new Error("API origin is not set");
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
	return request<UserDto>(`/bootstrap/operator`, { method: "POST" });
}

export function getUser(userId: string) {
	return request<UserExtendedDto>(`/users/${userId}`);
}

export function getStudents() {
	return request<UserExtendedDto[]>(`/students`);
}

export function registerUser(userId: string) {
	return request<RegistrationSessionDto>(`/admin/register/${userId}`, {
		method: "POST",
	});
}

export function unregisterUser(userId: string) {
	return request(`/admin/unregister/${userId}`, { method: "POST" });
}
