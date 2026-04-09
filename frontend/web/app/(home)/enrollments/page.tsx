import { getClasses, getEnrollments, getStudents } from "@/app/lib/api";
import { DataTableEnrollments } from "@/components/custom/data-table-enrollments";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const [enrollments, classes, students] = await Promise.all([
		getEnrollments(),
		getClasses(),
		getStudents(),
	]);

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Enrollments"
				description="Manage class assignments for students."
			/>
			<DataTableEnrollments
				enrollments={enrollments}
				classes={classes}
				students={students}
			/>
		</div>
	);
}
