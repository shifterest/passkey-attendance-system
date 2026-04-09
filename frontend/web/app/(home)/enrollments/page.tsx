import { getClasses, getEnrollments, getStudents } from "@/app/lib/api";
import { DataTableEnrollments } from "@/components/custom/data-table-enrollments";

export default async function Page() {
	const [enrollments, classes, students] = await Promise.all([
		getEnrollments(),
		getClasses(),
		getStudents(),
	]);

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableEnrollments
				enrollments={enrollments}
				classes={classes}
				students={students}
			/>
		</div>
	);
}
