"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
	const router = useRouter();
	useEffect(() => {
		const token = localStorage.getItem("session_token");
		router.push(token ? "/dashboard" : "/login");
	}, [router]);
	return null;
}
