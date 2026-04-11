import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/custom/app-sidebar";
import {
	NavigationTransitionContent,
	NavigationTransitionProvider,
} from "@/components/custom/navigation-transition";
import { PageHeaderProvider } from "@/components/custom/page-header-context";
import { SiteHeader } from "@/components/custom/site-header";
import { UserProvider } from "@/components/custom/user-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	if (!cookieStore.get("session_token")?.value) {
		redirect("/login");
	}

	return (
		<UserProvider>
			<SidebarProvider
				style={
					{
						"--sidebar-width": "calc(var(--spacing) * 72)",
						"--header-height": "calc(var(--spacing) * 12)",
					} as React.CSSProperties
				}
			>
				<NavigationTransitionProvider>
					<AppSidebar variant="inset" />
					<SidebarInset>
						<PageHeaderProvider>
							<SiteHeader />
							<NavigationTransitionContent className="@container/main">
								<div className="flex flex-1 flex-col gap-2">{children}</div>
							</NavigationTransitionContent>
						</PageHeaderProvider>
					</SidebarInset>
				</NavigationTransitionProvider>
			</SidebarProvider>
		</UserProvider>
	);
}
