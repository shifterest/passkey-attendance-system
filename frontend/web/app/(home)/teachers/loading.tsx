import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="flex flex-col gap-4 px-4 lg:px-6">
				<div className="flex items-center gap-2">
					<Skeleton className="h-9 w-64" />
					<Skeleton className="ml-auto h-9 w-24" />
					<Skeleton className="h-9 w-32" />
				</div>
				<div className="border rounded-lg">
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
				<div className="flex items-center justify-between">
					<Skeleton className="h-4 w-40" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-8 w-8" />
						<Skeleton className="h-8 w-8" />
						<Skeleton className="h-8 w-8" />
						<Skeleton className="h-8 w-8" />
					</div>
				</div>
			</div>
		</div>
	);
}
