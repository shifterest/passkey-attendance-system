export type IconItem =
	| "dashboard"
	| "logs"
	| "users"
	| "students"
	| "teachers"
	| "admins"
	| "classes"
	| "records";

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
		{ title: "Dashboard", url: "/home/dashboard", icon: "dashboard" },
		{ title: "Logs", url: "/home/logs", icon: "logs" },
	] satisfies NavItem[],
	management: [
		{
			name: "Users",
			url: "/home/users",
			icon: "users",
			items: [
				{
					title: "Students",
					url: "/home/users?filter=student",
					icon: "students",
				},
				{
					title: "Teachers",
					url: "/home/users?filter=teacher",
					icon: "teachers",
				},
				{ title: "Admins", url: "/home/users?filter=admin", icon: "admins" },
			],
		},
		{ name: "Classes", url: "/home/classes", icon: "classes" },
		{ name: "Records", url: "/home/records", icon: "records" },
	] satisfies NavGroup[],
};

export function getPageTitle(pathname: string): string {
	const infoItem = navigation.information.find((item) => item.url === pathname);
	if (infoItem) return infoItem.title;

	for (const group of navigation.management) {
		if (group.url === pathname) return group.name;
		const subItem = group.items?.find((item) => item.url === pathname);
		if (subItem) return subItem.title;
	}

	if (pathname === "/home") return "Dashboard";

	return "Dashboard";
}
