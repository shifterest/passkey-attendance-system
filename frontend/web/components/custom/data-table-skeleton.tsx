"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DataTableSkeleton() {
	return (
		// TODO: Fix these stupid skeletons
		// TODO: Should we keep this div?
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<div className="rounded-lg border">
				<div className="border-b p-4">
					<div className="flex items-center gap-3">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-4" />
					</div>
				</div>
				{Array.from({ length: 10 }).map((_, index) => (
					<div className="border-b last:border-0 p-4" key={index}>
						<div className="flex items-center gap-3">
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-4" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
