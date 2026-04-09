export type IconItem =
	| "dashboard"
	| "logs"
	| "users"
	| "students"
	| "teachers"
	| "admins"
	| "classes"
	| "enrollments"
	| "records"
	| "orgs";

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
		{ name: "Classes", url: "/classes", icon: "classes" },
		{ name: "Enrollments", url: "/enrollments", icon: "enrollments" },
		{ name: "Records", url: "/records", icon: "records" },
		{ name: "Organizations", url: "/orgs", icon: "orgs" },
	] satisfies NavGroup[],
};

export function getPageTitle(pathname: string): string {
	if (pathname === "/account") return "Account";
	if (pathname === "/settings") return "Settings";
	const infoItem = navigation.information.find((item) => item.url === pathname);
	if (infoItem) return infoItem.title;

	for (const group of navigation.management) {
		if (group.url === pathname) return group.name;
		const subItem = group.items?.find((item) => item.url === pathname);
		if (subItem) return subItem.title;
	}

	return "Dashboard";
}
