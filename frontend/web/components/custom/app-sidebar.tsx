"use client";

import {
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
import { useUser } from "@/components/custom/user-context";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

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
	};

	const { user, loading } = useUser();
	const role = user?.role ?? null;

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
								<IconKey />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									Passkey Attendance System
								</span>
								{loading ? (
									<div className="truncate text-xs">
										<Skeleton className="h-4 w-[50px]" />
									</div>
								) : (
									<span className="truncate text-xs capitalize">{role}</span>
								)}
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavInformation items={navigation.information} iconMap={iconMap} />
				<NavManagement items={navigation.management} iconMap={iconMap} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
