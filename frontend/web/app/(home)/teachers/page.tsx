import { getTeachers } from "@/app/lib/api";
import { DataTableTeachers } from "@/components/custom/data-table-teachers";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const teachers = await getTeachers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Teachers"
				description="View teacher accounts, class assignments, and session status."
			/>
			<DataTableTeachers data={teachers} />
		</div>
	);
}
