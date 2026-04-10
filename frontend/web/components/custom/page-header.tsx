"use client";

import type * as React from "react";

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between px-4 lg:px-6">
			<div>
				<h2 className="font-heading heading-balanced text-xl font-semibold">
					{title}
				</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}
