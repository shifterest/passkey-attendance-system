"use client";

import {
	IconAlertTriangle,
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
	IconFlag,
	IconRefresh,
	IconShield,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import type { AttendanceRecordDto } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

function formatTimestamp(ts: string) {
	return new Date(ts).toLocaleString();
}

function statusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	if (status === "present") return "default";
	if (status === "late") return "secondary";
	return "outline";
}

function assuranceBand(score: number) {
	if (score >= 25)
		return { label: "High", cls: "text-green-600 dark:text-green-400" };
	if (score >= 10) return { label: "Standard", cls: "text-muted-foreground" };
	return { label: "Low", cls: "text-red-600 dark:text-red-400" };
}

const MAX_METHODS = 3;

const columns: ColumnDef<AttendanceRecordDto>[] = [
	{
		accessorKey: "timestamp",
		header: "Timestamp",
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-sm">
				{formatTimestamp(row.original.timestamp)}
			</span>
		),
	},
	{
		accessorKey: "user_id",
		header: "User",
		cell: ({ row }) => (
			<span className="font-mono text-xs">
				{row.original.user_id.slice(0, 8)}…
			</span>
		),
	},
	{
		accessorKey: "session_id",
		header: "Session",
		cell: ({ row }) => (
			<span className="font-mono text-xs">
				{row.original.session_id.slice(0, 8)}…
			</span>
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => (
			<Badge
				variant={statusVariant(row.original.status)}
				className="capitalize"
			>
				{row.original.status}
			</Badge>
		),
	},
	{
		accessorKey: "assurance_score",
		header: "Score",
		cell: ({ row }) => {
			const score = row.original.assurance_score;
			const band = assuranceBand(score);
			return (
				<div className="flex items-center gap-1.5">
					<span className="font-medium tabular-nums">{score}</span>
					<span className={`text-xs ${band.cls}`}>{band.label}</span>
				</div>
			);
		},
	},
	{
		accessorKey: "verification_methods",
		header: "Methods",
		cell: ({ row }) => {
			const methods = row.original.verification_methods;
			const shown = methods.slice(0, MAX_METHODS);
			const overflow = methods.length - shown.length;
			return (
				<div className="flex flex-wrap gap-1">
					{shown.map((m) => (
						<Badge
							key={m}
							variant="outline"
							className="px-1.5 text-xs capitalize"
						>
							{m.replace(/_/g, " ")}
						</Badge>
					))}
					{overflow > 0 && (
						<Badge variant="outline" className="px-1.5 text-xs">
							+{overflow}
						</Badge>
					)}
				</div>
			);
		},
	},
	{
		id: "flags",
		header: "Flags",
		cell: ({ row }) => {
			const r = row.original;
			return (
				<div className="flex items-center gap-1.5">
					{r.network_anomaly && (
						<span title="Network anomaly">
							<IconAlertTriangle className="size-4 text-yellow-500" />
						</span>
					)}
					{r.is_flagged && (
						<span title="Flagged by teacher">
							<IconFlag className="size-4 text-red-500" />
						</span>
					)}
					{r.sync_pending && (
						<span title="Sync pending">
							<IconRefresh className="size-4 text-muted-foreground" />
						</span>
					)}
					{r.manually_approved && (
						<span title="Manually approved">
							<IconCheck className="size-4 text-green-500" />
						</span>
					)}
					{r.gps_is_mock && (
						<span title="Mock GPS detected">
							<IconShield className="size-4 text-orange-500" />
						</span>
					)}
				</div>
			);
		},
	},
];

export function DataTableRecords({ data }: { data: AttendanceRecordDto[] }) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "timestamp", desc: true },
	]);

	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 20 } },
	});

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No records found." />
			<div className="flex items-center justify-between px-2">
				<span className="text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} records
				</span>
				<div className="flex items-center gap-2">
					<Select
						value={String(table.getState().pagination.pageSize)}
						onValueChange={(v) => table.setPageSize(Number(v))}
					>
						<SelectTrigger className="h-8 w-24">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{[10, 20, 50, 100].map((n) => (
									<SelectItem key={n} value={String(n)}>
										{n} / page
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<IconChevronLeft className="size-4" />
					</Button>
					<span className="text-sm text-muted-foreground">
						{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
					</span>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<IconChevronRight className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
