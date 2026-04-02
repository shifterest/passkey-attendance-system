"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
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
		<div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
			<IconAlertTriangle className="size-10 text-muted-foreground" />
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">Something went wrong</p>
				{error.digest && (
					<p className="font-mono text-xs text-muted-foreground">
						{error.digest}
					</p>
				)}
			</div>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={reset}>
					Try again
				</Button>
				<Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
					Dashboard
				</Button>
			</div>
		</div>
	);
}
