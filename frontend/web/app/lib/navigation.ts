import { orgEventsEnabled } from "@/app/lib/features";

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
	people: [
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
	] satisfies NavGroup[],
	academics: [
		{ name: "Semesters", url: "/semesters", icon: "semesters" },
		{ name: "Classes", url: "/classes", icon: "classes" },
		{ name: "Enrollments", url: "/enrollments", icon: "enrollments" },
		{ name: "Records", url: "/records", icon: "records" },
	] satisfies NavGroup[],
	organizations: orgEventsEnabled
		? ([
				{ name: "Organizations", url: "/orgs", icon: "orgs" },
				{ name: "Events", url: "/events", icon: "events" },
			] satisfies NavGroup[])
		: ([] satisfies NavGroup[]),
};

export function getPageTitle(pathname: string): string {
	if (pathname === "/account") return "Account";
	if (pathname === "/settings") return "Settings";
	if (pathname === "/policies") return "Policies";
	const infoItem = navigation.information.find((item) => item.url === pathname);
	if (infoItem) return infoItem.title;

	for (const group of [
		...navigation.people,
		...navigation.academics,
		...navigation.organizations,
	] as NavGroup[]) {
		if (group.url === pathname) return group.name;
		const subItem = group.items?.find((item) => item.url === pathname);
		if (subItem) return subItem.title;
	}

	return "Dashboard";
}

export function getSearchPlaceholder(_pathname: string): string {
	return "Search everything";
}
