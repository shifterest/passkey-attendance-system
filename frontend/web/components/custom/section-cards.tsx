"use client";

import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	IconCircle,
	IconClipboard,
	IconExclamationCircle,
} from "@tabler/icons-react";

export function SectionCards() {
	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			<Card className="@container/card bg-gradient-to-t !from-yellow-500/5 dark:!from-yellow-500/10">
				<CardHeader>
					<CardDescription>Attendance records today</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						420
					</CardTitle>
					<CardAction>
						<IconClipboard />
					</CardAction>
				</CardHeader>
			</Card>
			<Card className="@container/card bg-gradient-to-t !from-red-500/5 dark:!from-red-500/10">
				<CardHeader>
					<CardDescription>Flagged attendance records today</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						67
					</CardTitle>
					<CardAction>
						<IconExclamationCircle />
					</CardAction>
				</CardHeader>
			</Card>
			<Card className="@container/card bg-gradient-to-t !from-green-500/5 dark:!from-green-500/10">
				<CardHeader>
					<CardDescription>Active login sessions</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						69
					</CardTitle>
					<CardAction>
						<IconCircle />
					</CardAction>
				</CardHeader>
			</Card>
		</div>
	);
}
