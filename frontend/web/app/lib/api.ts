const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN;

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
}

export type 

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	if (!API_ORIGIN) throw new Error("NEXT_PUBLIC_API_ORIGIN is not set");
	const res = await fetch(`${API_ORIGIN}${path}`, init);
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
	return request<RegistrationSessionDto>(`/admin/register/${userId}`);
}

export function unregisterUser(userId: string) {
	return request(`/admin/unregister/${userId}`);
}
