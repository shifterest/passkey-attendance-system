"use client";

import {
	IconMoon,
	IconMinus,
	IconSettings2,
	IconPlus,
	IconSun,
	IconTable,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PAGE_SIZE_KEY = "pas_default_page_size";
const PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];
const PAGE_SIZE_NUMBERS = PAGE_SIZE_OPTIONS.map((value) => Number(value));

function resolveClosestPageSize(value: number) {
	return PAGE_SIZE_NUMBERS.reduce((closest, option) => {
		return Math.abs(option - value) < Math.abs(closest - value)
			? option
			: closest;
	}, PAGE_SIZE_NUMBERS[0]);
}

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

	function persistPageSize(value: number) {
		const normalized = resolveClosestPageSize(value);
		const next = String(normalized);
		setPageSize(next);
		localStorage.setItem(PAGE_SIZE_KEY, next);
	}

	function adjustPageSize(direction: -1 | 1) {
		const current = Number(pageSize);
		const currentValue = PAGE_SIZE_NUMBERS.includes(current)
			? current
			: PAGE_SIZE_NUMBERS[0];
		const currentIndex = PAGE_SIZE_NUMBERS.indexOf(currentValue);
		const nextIndex = Math.min(
			PAGE_SIZE_NUMBERS.length - 1,
			Math.max(0, currentIndex + direction),
		);
		persistPageSize(PAGE_SIZE_NUMBERS[nextIndex]);
	}

	function handlePageSizeInputChange(value: string) {
		const digits = value.replace(/\D/g, "").slice(0, 3);
		setPageSize(digits);
		const parsed = Number(digits);
		if (PAGE_SIZE_NUMBERS.includes(parsed)) {
			localStorage.setItem(PAGE_SIZE_KEY, String(parsed));
		}
	}

	function handlePageSizeBlur() {
		persistPageSize(Number(pageSize) || PAGE_SIZE_NUMBERS[0]);
	}

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
								Default row count for data-table pagination. Supported values
								are 10, 20, 50, and 100.
							</FieldDescription>
						</FieldContent>
						<ButtonGroup>
							<Input
								value={pageSize}
								onChange={(e) => handlePageSizeInputChange(e.target.value)}
								onBlur={handlePageSizeBlur}
								inputMode="numeric"
								maxLength={3}
								className="h-8 w-16 text-center font-mono"
								aria-label="Rows per page"
							/>
							<Button
								variant="outline"
								size="icon-sm"
								type="button"
								aria-label="Decrease rows per page"
								onClick={() => adjustPageSize(-1)}
								disabled={
									resolveClosestPageSize(
										Number(pageSize) || PAGE_SIZE_NUMBERS[0],
									) <= PAGE_SIZE_NUMBERS[0]
								}
							>
								<IconMinus />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								type="button"
								aria-label="Increase rows per page"
								onClick={() => adjustPageSize(1)}
								disabled={
									resolveClosestPageSize(
										Number(pageSize) || PAGE_SIZE_NUMBERS[0],
									) >= PAGE_SIZE_NUMBERS[PAGE_SIZE_NUMBERS.length - 1]
								}
							>
								<IconPlus />
							</Button>
						</ButtonGroup>
					</Field>
				</FieldGroup>
			</div>
		</div>
	);
}
