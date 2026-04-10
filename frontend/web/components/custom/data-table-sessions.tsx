"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { CheckInSessionDto } from "@/app/lib/api";
import { closeSession } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableRowActions,
} from "@/components/custom/data-table-shared";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

function formatDt(s: string) {
	return new Date(s).toLocaleString();
}

export function DataTableSessions({ data }: { data: CheckInSessionDto[] }) {
	const router = useRouter();
	const [closedIds, setClosedIds] = React.useState<Set<string>>(new Set());

	const columns = React.useMemo<ColumnDef<CheckInSessionDto>[]>(
		() => [
			{
				accessorKey: "start_time",
				header: "Start",
				cell: ({ row }) => (
					<span className="whitespace-nowrap">
						{formatDt(row.original.start_time)}
					</span>
				),
			},
			{
				accessorKey: "end_time",
				header: "End",
				cell: ({ row }) => (
					<span className="whitespace-nowrap">
						{formatDt(row.original.end_time)}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = closedIds.has(row.original.id)
						? "closed"
						: row.original.status;
					return (
						<Badge
							variant={status === "open" ? "default" : "secondary"}
							className="capitalize"
						>
							{status}
						</Badge>
					);
				},
			},
			{
				id: "window",
				header: "Window",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						Present ≤{row.original.present_cutoff_minutes}m · Late ≤
						{row.original.late_cutoff_minutes}m
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const s = row.original;
					const isClosed = closedIds.has(s.id);
					return (
						<DataTableRowActions>
							<DropdownMenuGroup>
								<DropdownMenuItem
									render={
										<Link
											href={`/classes/${s.class_id}/sessions/${s.id}/records`}
										/>
									}
								>
									View records
								</DropdownMenuItem>
								{s.status === "open" && !isClosed && (
									<DropdownMenuItem
										onClick={() => {
											setClosedIds((prev) => new Set(prev).add(s.id));
											closeSession(s.id)
												.then(() => router.refresh())
												.catch(() =>
													setClosedIds((prev) => {
														const next = new Set(prev);
														next.delete(s.id);
														return next;
													}),
												);
										}}
									>
										Close session
									</DropdownMenuItem>
								)}
							</DropdownMenuGroup>
						</DataTableRowActions>
					);
				},
			},
		],
		[closedIds, router],
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<DataTableBody
				table={table}
				columnCount={columns.length}
				emptyMessage="No sessions found."
			/>
		</div>
	);
}
