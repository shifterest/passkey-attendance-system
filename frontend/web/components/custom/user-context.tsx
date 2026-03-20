"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getUser, type UserDto } from "@/app/lib/api";

type UserContextValue = {
	user: UserDto | null;
	loading: boolean;
};

const UserContext = createContext<UserContextValue>({
	user: null,
	loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<UserDto | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const run = async () => {
			try {
				const userId = localStorage.getItem("user_id");
				if (!userId) throw new Error("Missing user ID");
				const data = await getUser(userId);
				setUser(data);
			} catch (error) {
				console.error("Failed to fetch user data", error);
			} finally {
				setLoading(false);
			}
		};
		run();
	}, []);

	return (
		<UserContext.Provider value={{ user, loading }}>
			{children}
		</UserContext.Provider>
	);
}

export function useUser() {
	return useContext(UserContext);
}
