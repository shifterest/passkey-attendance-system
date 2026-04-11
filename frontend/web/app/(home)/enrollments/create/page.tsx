import { getClasses, getStudents } from "@/app/lib/api";
import { EnrollmentCreateClient } from "@/components/custom/enrollment-create-client";

export default async function Page() {
	const [classes, students] = await Promise.all([getClasses(), getStudents()]);

	return (
		<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
			<EnrollmentCreateClient classes={classes} students={students} />
		</div>
	);
}
