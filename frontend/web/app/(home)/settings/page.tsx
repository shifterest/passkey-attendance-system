"use client";

import {
	IconMoon,
	IconSettings2,
	IconSun,
	IconTable,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SetPageHeader } from "@/components/custom/page-header-context";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PAGE_SIZE_KEY = "pas_default_page_size";
const PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];

export default function SettingsPage() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [pageSize, setPageSize] = useState("10");

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(PAGE_SIZE_KEY);
		if (stored && PAGE_SIZE_OPTIONS.includes(stored)) {
			setPageSize(stored);
		}
	}, []);

	function handlePageSizeChange(value: string) {
		setPageSize(value);
		localStorage.setItem(PAGE_SIZE_KEY, value);
	}

	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<SetPageHeader title="Settings" description="Manage your preferences." />
			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Appearance</CardTitle>
						<CardDescription>Choose your preferred theme.</CardDescription>
					</CardHeader>
					<CardContent>
						{mounted && (
							<ToggleGroup
								variant="outline"
								value={theme ? [theme] : ["system"]}
								onValueChange={(value) => {
									if (value.length > 0) setTheme(value[0]);
								}}
							>
								<ToggleGroupItem value="light" aria-label="Light theme">
									<IconSun data-icon="inline-start" />
									Light
								</ToggleGroupItem>
								<ToggleGroupItem value="system" aria-label="System theme">
									<IconSettings2 data-icon="inline-start" />
									System
								</ToggleGroupItem>
								<ToggleGroupItem value="dark" aria-label="Dark theme">
									<IconMoon data-icon="inline-start" />
									Dark
								</ToggleGroupItem>
							</ToggleGroup>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconTable className="size-5 text-muted-foreground" />
							<CardTitle>Tables</CardTitle>
						</div>
						<CardDescription>
							Default display preferences for data tables.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<span className="text-sm">Rows per page</span>
							{mounted && (
								<Select value={pageSize} onValueChange={handlePageSizeChange}>
									<SelectTrigger className="w-20">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZE_OPTIONS.map((n) => (
											<SelectItem key={n} value={n}>
												{n}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
