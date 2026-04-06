"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import type { CheckInSessionDto } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";

function formatDt(s: string) {
	return new Date(s).toLocaleString();
}

const columns: ColumnDef<CheckInSessionDto>[] = [
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
		cell: ({ row }) => (
			<Badge
				variant={row.original.status === "open" ? "default" : "secondary"}
				className="capitalize"
			>
				{row.original.status}
			</Badge>
		),
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
		cell: ({ row }) => (
			<Link
				href={`/classes/${row.original.class_id}/sessions/${row.original.id}/records`}
				className="text-sm font-medium text-primary hover:underline"
			>
				View records
			</Link>
		),
	},
];

export function DataTableSessions({ data }: { data: CheckInSessionDto[] }) {
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
