"use client";

import {
	IconDotsVertical,
	IconLogout,
	IconSettings,
	IconUserCircle,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getUser } from "@/app/lib/api";
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

export function NavUser() {
	const { isMobile } = useSidebar();
	const [loading, setLoading] = useState(true);

	const [fullName, setFullName] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [schoolId, setSchoolId] = useState<string | null>(null);

	useEffect(() => {
		const run = async () => {
			try {
				const userId = localStorage.getItem("user_id");
				if (!userId) throw new Error("Missing user ID");
				const data = await getUser(userId);
				setFullName(data.full_name);
				setEmail(data.email);
				setSchoolId(data.school_id);
			} catch (error) {
				console.error("Failed to fetch user data", error);
			} finally {
				setLoading(false);
			}
		};
		run();
	}, []);

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
							<span className="truncate font-medium">{fullName}</span>
							<span className="text-foreground/70 truncate text-xs">
								{schoolId ? `${schoolId}· ${email}` : email}
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
										<span className="truncate font-medium">{fullName}</span>
										<span className="text-muted-foreground truncate text-xs">
											{email}
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
						<DropdownMenuItem>
							<IconLogout />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
