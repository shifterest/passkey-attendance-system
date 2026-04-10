"use client";

import { usePathname } from "next/navigation";
import { TransitionLink } from "@/components/custom/navigation-transition";
import {
	SidebarGroup,
	SidebarGroupContent,
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
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => {
						const Icon = iconMap[item.icon];
						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									render={<TransitionLink href={item.url} />}
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
