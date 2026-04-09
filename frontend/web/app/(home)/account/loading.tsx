import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Skeleton className="h-52" />
				<Skeleton className="h-52" />
				<Skeleton className="h-52" />
			</div>
		</div>
	);
}
