"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavInformation({
	items,
	iconMap,
}: {
	items: {
		title: string;
		url: string;
		icon: string;
	}[];
	iconMap: Record<string, React.ComponentType>;
}) {
	const pathname = usePathname();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Information</SidebarGroupLabel>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => {
						const Icon = iconMap[item.icon];
						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									render={<Link href={item.url} />}
									isActive={pathname === item.url}
								>
									<Icon />
									<span>{item.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
