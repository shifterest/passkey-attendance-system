import { DataTableSkeleton } from "@/components/custom/data-table-skeleton";

export default function Loading() {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableSkeleton />
		</div>
	);
}
