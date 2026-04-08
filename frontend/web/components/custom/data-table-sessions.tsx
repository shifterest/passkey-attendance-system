"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import * as React from "react";
import type { CheckInSessionDto } from "@/app/lib/api";
import { closeSession } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatDt(s: string) {
	return new Date(s).toLocaleString();
}

export function DataTableSessions({ data }: { data: CheckInSessionDto[] }) {
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
						<div className="flex items-center gap-2">
							<Button
								variant="link"
								size="xs"
								render={
									<Link
										href={`/classes/${s.class_id}/sessions/${s.id}/records`}
									/>
								}
							>
								View records
							</Button>
							{s.status === "open" && !isClosed && (
								<Button
									size="sm"
									variant="outline"
									className="h-7 text-xs"
									onClick={() => {
										setClosedIds((prev) => new Set(prev).add(s.id));
										closeSession(s.id).catch(() =>
											setClosedIds((prev) => {
												const next = new Set(prev);
												next.delete(s.id);
												return next;
											}),
										);
									}}
								>
									Close
								</Button>
							)}
						</div>
					);
				},
			},
		],
		[closedIds],
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No sessions found." />
		</div>
	);
}
