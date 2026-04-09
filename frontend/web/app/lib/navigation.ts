export type IconItem =
	| "dashboard"
	| "logs"
	| "users"
	| "students"
	| "teachers"
	| "admins"
	| "semesters"
	| "classes"
	| "enrollments"
	| "records"
	| "policies"
	| "orgs"
	| "events";

export type NavItem = {
	title: string;
	url: string;
	icon: IconItem;
};

export type NavGroup = {
	name: string;
	url: string;
	icon: IconItem;
	items?: NavItem[];
};

export const navigation = {
	information: [
		{ title: "Dashboard", url: "/dashboard", icon: "dashboard" },
		{ title: "Logs", url: "/logs", icon: "logs" },
	] satisfies NavItem[],
	management: [
		{
			name: "Users",
			url: "/users",
			icon: "users",
			items: [
				{
					title: "Students",
					url: "/students",
					icon: "students",
				},
				{
					title: "Teachers",
					url: "/teachers",
					icon: "teachers",
				},
				{ title: "Admins", url: "/admins", icon: "admins" },
			],
		},
		{ name: "Semesters", url: "/semesters", icon: "semesters" },
		{ name: "Classes", url: "/classes", icon: "classes" },
		{ name: "Enrollments", url: "/enrollments", icon: "enrollments" },
		{ name: "Records", url: "/records", icon: "records" },
		{ name: "Policies", url: "/policies", icon: "policies" },
	] satisfies NavGroup[],
	organizations: [
		{ name: "Organizations", url: "/orgs", icon: "orgs" },
		{ name: "Events", url: "/events", icon: "events" },
	] satisfies NavGroup[],
};

export function getPageTitle(pathname: string): string {
	if (pathname === "/account") return "Account";
	if (pathname === "/settings") return "Settings";
	const infoItem = navigation.information.find((item) => item.url === pathname);
	if (infoItem) return infoItem.title;

	for (const group of [
		...navigation.management,
		...navigation.organizations,
	] as NavGroup[]) {
		if (group.url === pathname) return group.name;
		const subItem = group.items?.find((item) => item.url === pathname);
		if (subItem) return subItem.title;
	}

	return "Dashboard";
}

export function getSearchPlaceholder(pathname: string): string {
	if (pathname.startsWith("/students")) return "Search students...";
	if (pathname.startsWith("/teachers")) return "Search teachers...";
	if (pathname.startsWith("/admins")) return "Search admins...";
	if (pathname.startsWith("/users")) return "Search users...";
	if (pathname.startsWith("/semesters")) return "Search semesters...";
	if (pathname.startsWith("/classes/")) return "Search sessions...";
	if (pathname.startsWith("/classes")) return "Search classes...";
	if (pathname.startsWith("/enrollments")) return "Search enrollments...";
	if (pathname.startsWith("/records")) return "Search records...";
	if (pathname.startsWith("/logs")) return "Search audit logs...";
	if (pathname.startsWith("/policies")) return "Search policies...";
	if (pathname.startsWith("/orgs")) return "Search organizations...";
	if (pathname.startsWith("/events")) return "Search events...";
	return "Search users, classes, and records...";
}
