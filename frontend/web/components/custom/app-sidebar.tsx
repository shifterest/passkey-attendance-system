"use client";

import {
	IconCalendarEvent,
	IconChalkboard,
	IconChalkboardTeacher,
	IconClipboard,
	IconDashboard,
	IconKey,
	IconLogs,
	IconTool,
	IconUser,
	IconUserEdit,
	IconUsersGroup,
} from "@tabler/icons-react";
import type * as React from "react";
import { type IconItem, navigation } from "@/app/lib/navigation";
import { NavInformation } from "@/components/custom/nav-information";
import { NavManagement } from "@/components/custom/nav-management";
import { NavUser } from "@/components/custom/nav-user";
import { SearchForm } from "@/components/custom/search-form";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const iconMap: Record<
		IconItem,
		React.ComponentType<{ className?: string }>
	> = {
		dashboard: IconDashboard,
		logs: IconLogs,
		users: IconUser,
		students: IconUserEdit,
		teachers: IconChalkboardTeacher,
		admins: IconTool,
		classes: IconChalkboard,
		enrollments: IconClipboard,
		records: IconClipboard,
		orgs: IconUsersGroup,
		events: IconCalendarEvent,
	};

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SearchForm />
			</SidebarHeader>
			<SidebarContent>
				<NavInformation items={navigation.information} iconMap={iconMap} />
				<NavManagement
					label="Management"
					items={navigation.management}
					iconMap={iconMap}
				/>
				<NavManagement
					label="Organizations"
					items={navigation.organizations}
					iconMap={iconMap}
				/>
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
