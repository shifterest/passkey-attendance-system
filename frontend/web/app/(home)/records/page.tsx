import { getAllRecords } from "@/app/lib/api";
import { DataTableRecords } from "@/components/custom/data-table-records";
import { SetPageHeader } from "@/components/custom/page-header-context";

export default async function Page() {
	const records = await getAllRecords();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Attendance Records"
				description="Review attendance check-in records and assurance scores."
			/>
			<DataTableRecords data={records} />
		</div>
	);
}
