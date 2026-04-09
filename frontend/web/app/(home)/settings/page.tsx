"use client";

import { IconMoon, IconSettings2, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function SettingsPage() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<div>
				<h2 className="text-xl font-semibold">Settings</h2>
				<p className="text-sm text-muted-foreground">
					Manage your preferences.
				</p>
			</div>
			<Separator />
			<Card className="max-w-md">
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Choose your preferred theme.</CardDescription>
				</CardHeader>
				<CardContent>
					{mounted && (
						<ToggleGroup
							type="single"
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
		</div>
	);
}
