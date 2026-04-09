import { getClasses, getPolicies, getTeachers } from "@/app/lib/api";
import { DataTablePolicies } from "@/components/custom/data-table-policies";

export default async function Page() {
	const [policies, classes, teachers] = await Promise.all([
		getPolicies(),
		getClasses(),
		getTeachers(),
	]);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTablePolicies
				policies={policies}
				classes={classes}
				teachers={teachers}
			/>
		</div>
	);
}
