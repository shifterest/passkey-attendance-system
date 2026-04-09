import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
	return (
		<div className="@container/card rounded-xl border p-4">
			<div className="flex items-start justify-between">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-8 w-16" />
				</div>
				<Skeleton className="h-6 w-6 rounded" />
			</div>
		</div>
	);
}

function SkeletonChart() {
	return (
		<div className="rounded-xl border">
			<div className="flex items-center justify-between p-6 pb-0">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-9 w-28 rounded-lg" />
			</div>
			<div className="p-6">
				<Skeleton className="h-[250px] w-full rounded-lg" />
			</div>
		</div>
	);
}

export default function Loading() {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
			<div className="px-4 lg:px-6">
				<SkeletonChart />
			</div>
		</div>
	);
}
