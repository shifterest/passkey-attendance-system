"use client";

import {
	IconCalendar,
	IconCalendarEvent,
	IconChalkboard,
	IconChalkboardTeacher,
	IconClipboard,
	IconLayoutDashboardFilled,
	IconLogs,
	IconScale,
	IconTool,
	IconUser,
	IconUserEdit,
	IconUsersGroup,
} from "@tabler/icons-react";
import type * as React from "react";
import { type IconItem, navigation } from "@/app/lib/navigation";
import { CommandMenu } from "@/components/custom/command-menu";
import { NavInformation } from "@/components/custom/nav-information";
import { NavManagement } from "@/components/custom/nav-management";
import { NavUser } from "@/components/custom/nav-user";
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
		dashboard: IconLayoutDashboardFilled,
		logs: IconLogs,
		users: IconUser,
		students: IconUserEdit,
		teachers: IconChalkboardTeacher,
		admins: IconTool,
		semesters: IconCalendar,
		classes: IconChalkboard,
		enrollments: IconClipboard,
		records: IconClipboard,
		policies: IconScale,
		orgs: IconUsersGroup,
		events: IconCalendarEvent,
	};

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<CommandMenu />
			</SidebarHeader>
			<SidebarContent>
				<NavInformation items={navigation.information} iconMap={iconMap} />
				<NavManagement
					label="Management"
					items={navigation.management}
					iconMap={iconMap}
				/>
				{navigation.organizations.length > 0 ? (
					<NavManagement
						label="Organizations"
						items={navigation.organizations}
						iconMap={iconMap}
					/>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
