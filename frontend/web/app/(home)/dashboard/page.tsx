import { getRecords, getSessions } from "@/app/lib/api";
import { ChartAreaInteractive } from "@/components/custom/chart-area-interactive";
import { SectionCards } from "@/components/custom/section-cards";

export default async function Page() {
	const [records, sessions] = await Promise.all([
		getRecords({ limit: 1000 }),
		getSessions({ limit: 100 }),
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
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SectionCards
				recordsToday={recordsToday}
				flaggedToday={flaggedToday}
				openSessions={openSessions}
			/>
			<div className="px-4 lg:px-6">
				<ChartAreaInteractive />
			</div>
		</div>
	);
}
