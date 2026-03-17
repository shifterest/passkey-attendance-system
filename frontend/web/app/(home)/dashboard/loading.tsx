import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
	return (
		<div className="flex flex-col gap-2 rounded-xl border p-4">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-8 w-16" />
			<Skeleton className="h-3 w-32" />
		</div>
	);
}

function SkeletonRow() {
	return (
		<div className="flex gap-4 px-4 py-3 border-b last:border-0">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-4 w-20" />
			<Skeleton className="h-4 w-16" />
		</div>
	);
}

export default function Loading() {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4 lg:px-6">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
			<div className="rounded-lg border mx-4 lg:mx-6">
				{Array.from({ length: 8 }).map((_, i) => (
					<SkeletonRow key={i} />
				))}
			</div>
		</div>
	);
}
