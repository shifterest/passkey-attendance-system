"use client";

import { IconAlertTriangle, IconChevronLeft } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="px-4 lg:px-6">
				<Button
					variant="ghost"
					className="gap-1 pl-0"
					render={<Link href="/classes" />}
				>
					<IconChevronLeft className="size-4" />
					Back to Classes
				</Button>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
				<IconAlertTriangle className="size-10 text-muted-foreground" />
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Could not load sessions</p>
					{error.digest && (
						<p className="font-mono text-xs text-muted-foreground">
							{error.digest}
						</p>
					)}
				</div>
				<Button variant="outline" size="sm" onClick={reset}>
					Try again
				</Button>
			</div>
		</div>
	);
}
