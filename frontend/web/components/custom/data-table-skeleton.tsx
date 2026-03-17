import { Skeleton } from "@/components/ui/skeleton";

const WIDTHS = [
	"w-24",
	"w-16",
	"w-28",
	"w-20",
	"w-24",
	"w-20",
	"w-28",
	"w-16",
] as const;

function getWidth(row: number, col: number) {
	return WIDTHS[(row * 3 + col) % WIDTHS.length];
}

export function DataTableSkeleton() {
	return (
		<div className="px-4 lg:px-6">
			<div className="rounded-lg border">
				{Array.from({ length: 10 }).map((_, row) => (
					<div
						key={row}
						className="flex items-center gap-3 border-b p-4 last:border-0"
					>
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-32" />
						{Array.from({ length: 3 }).map((_, col) => (
							<Skeleton key={col} className={`h-4 ${getWidth(row, col)}`} />
						))}
					</div>
				))}
			</div>
		</div>
	);
}
