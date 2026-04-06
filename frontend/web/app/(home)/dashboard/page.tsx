import { getAllRecords, getAllSessions } from "@/app/lib/api";
import { ChartAreaInteractive } from "@/components/custom/chart-area-interactive";
import { SectionCards } from "@/components/custom/section-cards";

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

export default async function Page() {
	const [records, sessions] = await Promise.all([
		getAllRecords(),
		getAllSessions(),
	]);
	const today = new Date().toDateString();
	const chartData = buildChartData(records);
	const recordsToday = records.filter(
		(r) => new Date(r.timestamp).toDateString() === today,
	).length;
	const flaggedToday = records.filter(
		(r) => r.is_flagged && new Date(r.timestamp).toDateString() === today,
	).length;
	const openSessions = sessions.filter((s) => s.status === "open").length;

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SectionCards
				recordsToday={recordsToday}
				flaggedToday={flaggedToday}
				openSessions={openSessions}
				totalSessions={sessions.length}
			/>
			<div className="px-4 lg:px-6">
				<ChartAreaInteractive data={chartData} />
			</div>
		</div>
	);
}
