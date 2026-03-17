import { getClasses } from "@/app/lib/api";
import { DataTableClasses } from "@/components/custom/data-table-classes";

export default async function Page() {
	const classes = await getClasses();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableClasses data={classes} />
		</div>
	);
}
