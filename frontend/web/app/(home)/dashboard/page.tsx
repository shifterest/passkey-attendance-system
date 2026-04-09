import {
	IconCircle,
	IconClipboard,
	IconExclamationCircle,
	IconStack2,
} from "@tabler/icons-react";
import { Suspense } from "react";
import { getAllRecords, getAllSessions } from "@/app/lib/api";
import { ChartAreaInteractive } from "@/components/custom/chart-area-interactive";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { SectionCards } from "@/components/custom/section-cards";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function buildChartData(records: Awaited<ReturnType<typeof getAllRecords>>) {
	const byDate = new Map<
		string,
		{ date: string; records: number; flagged: number }
	>();
	for (const record of records) {
		const date = record.timestamp.slice(0, 10);
		const current = byDate.get(date) ?? { date, records: 0, flagged: 0 };
		current.records += 1;
		if (record.is_flagged) {
			current.flagged += 1;
		}
		byDate.set(date, current);
	}
	return Array.from(byDate.values()).sort((left, right) =>
		left.date.localeCompare(right.date),
	);
}

function SectionCardsSkeleton() {
	const cards = [
		{
			label: "Attendance records today",
			icon: IconClipboard,
			color: "!from-yellow-500/5 dark:!from-yellow-500/10",
		},
		{
			label: "Flagged attendance records today",
			icon: IconExclamationCircle,
			color: "!from-red-500/5 dark:!from-red-500/10",
		},
		{
			label: "Open check-in sessions",
			icon: IconCircle,
			color: "!from-green-500/5 dark:!from-green-500/10",
		},
		{
			label: "Total sessions",
			icon: IconStack2,
			color: "!from-blue-500/5 dark:!from-blue-500/10",
		},
	];
	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			{cards.map((c) => (
				<Card
					key={c.label}
					className={`@container/card bg-gradient-to-t ${c.color}`}
				>
					<CardHeader>
						<CardDescription>{c.label}</CardDescription>
						<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
							<Skeleton className="h-8 w-12" />
						</CardTitle>
						<CardAction>
							<c.icon />
						</CardAction>
					</CardHeader>
				</Card>
			))}
		</div>
	);
}

function ChartSkeleton() {
	return (
		<div className="px-4 lg:px-6">
			<Card className="@container/card">
				<CardHeader>
					<CardTitle>Total attendance records</CardTitle>
					<CardDescription>
						Including flagged records (e.g. lacking verification methods)
					</CardDescription>
					<CardAction>
						<Skeleton className="h-9 w-28 rounded-lg" />
					</CardAction>
				</CardHeader>
				<div className="px-2 pb-6 pt-4 sm:px-6 sm:pt-6">
					<Skeleton className="h-[250px] w-full rounded-lg" />
				</div>
			</Card>
		</div>
	);
}

async function DashboardCards() {
	const [records, sessions] = await Promise.all([
		getAllRecords(),
		getAllSessions(),
	]);
	const today = new Date().toDateString();
	const recordsToday = records.filter(
		(r) => new Date(r.timestamp).toDateString() === today,
	).length;
	const flaggedToday = records.filter(
		(r) => r.is_flagged && new Date(r.timestamp).toDateString() === today,
	).length;
	const openSessions = sessions.filter((s) => s.status === "open").length;

	return (
		<SectionCards
			recordsToday={recordsToday}
			flaggedToday={flaggedToday}
			openSessions={openSessions}
			totalSessions={sessions.length}
		/>
	);
}

async function DashboardChart() {
	const records = await getAllRecords();
	const chartData = buildChartData(records);

	return (
		<div className="px-4 lg:px-6">
			<ChartAreaInteractive data={chartData} />
		</div>
	);
}

export default function Page() {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Dashboard"
				description="Overview of attendance activity and sessions."
			/>
			<Suspense fallback={<SectionCardsSkeleton />}>
				<DashboardCards />
			</Suspense>
			<Suspense fallback={<ChartSkeleton />}>
				<DashboardChart />
			</Suspense>
		</div>
	);
}
