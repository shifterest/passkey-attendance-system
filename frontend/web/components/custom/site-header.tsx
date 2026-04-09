"use client";

import { usePageHeaderState } from "@/components/custom/page-header-context";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
	const { title, description, actionsRef } = usePageHeaderState();

	return (
		<header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 h-4 data-vertical:self-auto"
				/>
				<div className="flex items-baseline gap-2 min-w-0">
					<h1 className="text-base font-medium whitespace-nowrap">{title}</h1>
					{description && (
						<span className="text-sm text-muted-foreground truncate hidden md:inline">
							{description}
						</span>
					)}
				</div>
				<div
					ref={actionsRef}
					className="ml-auto flex items-center gap-2 shrink-0"
				/>
			</div>
		</header>
	);
}
