"use client";

import {
	IconCircle,
	IconClipboard,
	IconExclamationCircle,
	IconStack2,
} from "@tabler/icons-react";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface SectionCardsProps {
	recordsToday: number;
	flaggedToday: number;
	openSessions: number;
	totalSessions: number;
}

export function SectionCards({
	recordsToday,
	flaggedToday,
	openSessions,
	totalSessions,
}: SectionCardsProps) {
	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			<Card className="@container/card bg-gradient-to-t !from-yellow-500/5 dark:!from-yellow-500/10">
				<CardHeader>
					<CardDescription>Attendance records today</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{recordsToday}
					</CardTitle>
					<CardAction>
						<IconClipboard />
					</CardAction>
				</CardHeader>
			</Card>
			<Card className="@container/card bg-gradient-to-t !from-red-500/5 dark:!from-red-500/10">
				<CardHeader>
					<CardDescription>Flagged attendance records today</CardDescription>
					{/* TODO: Should be something like "Low-assurance attendance records today" */}
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{flaggedToday}
					</CardTitle>
					<CardAction>
						<IconExclamationCircle />
					</CardAction>
				</CardHeader>
			</Card>
			<Card className="@container/card bg-gradient-to-t !from-green-500/5 dark:!from-green-500/10">
				<CardHeader>
					<CardDescription>Open check-in sessions</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{openSessions}
					</CardTitle>
					<CardAction>
						<IconCircle />
					</CardAction>
				</CardHeader>
			</Card>
			<Card className="@container/card bg-gradient-to-t !from-blue-500/5 dark:!from-blue-500/10">
				<CardHeader>
					<CardDescription>Total sessions</CardDescription>
					{/* TODO: Should be something like "Ongoing sessions" */}
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{totalSessions}
					</CardTitle>
					<CardAction>
						<IconStack2 />
					</CardAction>
				</CardHeader>
			</Card>
		</div>
	);
}
