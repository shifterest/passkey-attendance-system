"use client";

import {
	IconDotsVertical,
	IconLogout,
	IconSettings,
	IconUserCircle,
} from "@tabler/icons-react";
import { clearBrowserSession, logout } from "@/app/lib/api";
import { useUser } from "@/components/custom/user-context";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

// TODO: Use user id in loading state
export function NavUser() {
	const { isMobile } = useSidebar();
	const { user, loading } = useUser();

	const handleLogout = async () => {
		const userId = localStorage.getItem("user_id");
		const sessionToken = localStorage.getItem("session_token");
		if (userId && sessionToken) {
			try {
				await logout(userId, sessionToken);
			} catch (error) {
				console.error("Failed to logout cleanly", error);
			}
		}
		clearBrowserSession();
		window.location.href = "/login";
	};

	if (loading) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" className="cursor-wait">
						<Skeleton className="size-8 rounded-lg" />
						<div className="grid flex-1 text-left text-sm leading-tight gap-1">
							<Skeleton className="h-4 w-[120px]" />
							<Skeleton className="h-3 w-[100px]" />
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
						}
					>
						{/* <Avatar className="size-8 rounded-lg grayscale">
							<AvatarImage src={user.avatar} alt={fullName} />
							<AvatarFallback className="rounded-lg">CN</AvatarFallback>
						</Avatar> */}
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">{user?.full_name}</span>
							<span className="text-foreground/70 truncate text-xs">
								{user?.school_id
									? `${user.school_id} · ${user.email}`
									: user?.email}
							</span>
						</div>
						<IconDotsVertical className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="min-w-56"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									{/* <Avatar className="size-8">
										<AvatarImage src={user.avatar} alt={fullName} />
										<AvatarFallback className="rounded-lg">CN</AvatarFallback>
									</Avatar> */}
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">
											{user?.full_name}
										</span>
										<span className="text-muted-foreground truncate text-xs">
											{user?.email}
										</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<IconUserCircle />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem>
								<IconSettings />
								Settings
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleLogout}>
							<IconLogout />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
