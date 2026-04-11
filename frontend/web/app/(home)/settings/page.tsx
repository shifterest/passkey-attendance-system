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
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PAGE_SIZE_KEY = "pas_default_page_size";
const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"];

export default function SettingsPage() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [pageSize, setPageSize] = useState("25");

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(PAGE_SIZE_KEY);
		if (stored && PAGE_SIZE_OPTIONS.includes(stored)) {
			setPageSize(stored);
		}
	}, []);

	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<SetPageHeader title="Settings" description="Manage your preferences." />
			<div className="mx-auto w-full max-w-4xl">
				<FieldGroup>
					<Field orientation="horizontal">
						<FieldContent>
							<div className="flex items-center gap-2">
								<IconSettings2 className="size-4 text-muted-foreground" />
								<FieldLabel>Appearance</FieldLabel>
							</div>
							<FieldDescription>Choose your preferred theme.</FieldDescription>
						</FieldContent>
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
					</Field>
					<FieldSeparator />
					<Field orientation="horizontal">
						<FieldContent>
							<div className="flex items-center gap-2">
								<IconTable className="size-4 text-muted-foreground" />
								<FieldLabel>Rows per page</FieldLabel>
							</div>
							<FieldDescription>
								Default row count for data-table pagination.
							</FieldDescription>
						</FieldContent>
						{mounted && (
							<ToggleGroup
								variant="outline"
								value={[pageSize]}
								onValueChange={(value) => {
									if (value.length > 0) {
										setPageSize(value[0]);
										localStorage.setItem(PAGE_SIZE_KEY, value[0]);
									}
								}}
							>
								{PAGE_SIZE_OPTIONS.map((opt) => (
									<ToggleGroupItem
										key={opt}
										value={opt}
										aria-label={`${opt} rows`}
									>
										{opt}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						)}
					</Field>
				</FieldGroup>
			</div>
		</div>
	);
}
