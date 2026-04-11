import { NextResponse } from "next/server";

type SessionSyncBody = {
	sessionToken: string;
	expiresIn: number;
};

export async function POST(request: Request) {
	const body = (await request.json()) as Partial<SessionSyncBody>;
	if (
		typeof body.sessionToken !== "string" ||
		body.sessionToken.length === 0 ||
		typeof body.expiresIn !== "number" ||
		!Number.isFinite(body.expiresIn) ||
		body.expiresIn <= 0
	) {
		return NextResponse.json(
			{ error: "Invalid browser session payload" },
			{ status: 400 },
		);
	}

	const response = NextResponse.json({ ok: true });
	response.cookies.set("session_token", body.sessionToken, {
		path: "/",
		maxAge: Math.floor(body.expiresIn),
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return response;
}

export async function DELETE() {
	const response = NextResponse.json({ ok: true });
	response.cookies.set("session_token", "", {
		path: "/",
		maxAge: 0,
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return response;
}
