import { type RegistrationSessionDto, registerUser } from "./api";

export const getRegistrationSession = (
	userId: string,
): Promise<RegistrationSessionDto | null> => {
	return registerUser(userId)
		.then((session) => {
			return session;
		})
		.catch((err) => {
			console.error("Failed to get registration session:", err);
			return null;
		});
};
