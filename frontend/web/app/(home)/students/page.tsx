import { DataTable } from "@/components/custom/data-table-student";
import { getStudents } from "@/app/lib/api";

export default async function Page() {
	const students = await getStudents();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTable data={students} />
		</div>
	);
}
