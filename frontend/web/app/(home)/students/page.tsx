import { getStudents } from "@/app/lib/api";
import { DataTableStudent } from "@/components/custom/data-table-student";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const students = await getStudents();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Students"
				description="Manage student accounts, registrations, and enrollment status."
			/>
			<DataTableStudent data={students} />
		</div>
	);
}
