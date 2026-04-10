"use client";

import { usePathname } from "next/navigation";
import { TransitionLink } from "@/components/custom/navigation-transition";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavManagement({
	label,
	items,
	iconMap,
}: {
	label: string;
	items: {
		name: string;
		url: string;
		icon: string;
		items?: {
			title: string;
			url: string;
			icon: string;
		}[];
	}[];
	iconMap: Record<string, React.ComponentType>;
}) {
	const pathname = usePathname();

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					const Icon = iconMap[item.icon];
					return (
						<SidebarMenuItem key={item.name}>
							<SidebarMenuButton
								render={<TransitionLink href={item.url} />}
								isActive={pathname === item.url}
							>
								<Icon />
								<span>{item.name}</span>
							</SidebarMenuButton>
							{item.items?.length ? (
								<SidebarMenuSub>
									{item.items?.map((subItem) => {
										const SubIcon = iconMap[subItem.icon];
										return (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton
													render={<TransitionLink href={subItem.url} />}
													isActive={pathname === subItem.url}
												>
													<SubIcon />
													<span>{subItem.title}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										);
									})}
								</SidebarMenuSub>
							) : null}
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
