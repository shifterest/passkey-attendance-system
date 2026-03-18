import { getAllRecords } from "@/app/lib/api";
import { DataTableRecords } from "@/components/custom/data-table-records";

export default async function Page() {
	const records = await getAllRecords();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableRecords data={records} />
		</div>
	);
}
