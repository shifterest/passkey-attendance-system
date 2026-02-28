"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { getPageTitle } from "@/app/lib/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
	const pathname = usePathname();
	const pageTitle = getPageTitle(pathname);
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// This addressess a problem I don't completely understand lol
	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 h-4 data-vertical:self-auto"
				/>
				<h1 className="text-base font-medium">{pageTitle}</h1>
				{/* TODO: Add system theme selector */}
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-auto"
					onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
				>
					{!mounted ? (
						<IconSun />
					) : theme === "dark" ? (
						<IconSun />
					) : (
						<IconMoon />
					)}
				</Button>
			</div>
		</header>
	);
}
