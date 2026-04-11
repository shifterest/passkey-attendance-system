"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarToggleButton() {
	const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
	const isOpen = isMobile ? openMobile : open;

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className="-ml-1 rounded-2xl"
			onClick={toggleSidebar}
			aria-label={isOpen ? "Collapse navigation" : "Open navigation"}
		>
			<IconMenu2 className="size-4" />
		</Button>
	);
}
