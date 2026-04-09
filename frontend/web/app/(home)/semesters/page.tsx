import { getSemesters } from "@/app/lib/api";
import { DataTableSemesters } from "@/components/custom/data-table-semesters";

export default async function Page() {
	const semesters = await getSemesters();

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableSemesters data={semesters} />
		</div>
	);
}
