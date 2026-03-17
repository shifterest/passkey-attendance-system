"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { AuditEventDto } from "@/app/lib/api";
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

const EVENT_TYPE_COLORS: Record<string, string> = {
	manual_approval: "text-yellow-600 dark:text-yellow-400",
	credential_revoked: "text-red-600 dark:text-red-400",
	device_attestation_failure: "text-red-600 dark:text-red-400",
	device_attestation_verified: "text-blue-600 dark:text-blue-400",
	device_key_mismatch: "text-red-600 dark:text-red-400",
	device_signature_failure: "text-red-600 dark:text-red-400",
	sign_count_anomaly: "text-orange-500 dark:text-orange-400",
	bootstrap_attempt: "text-purple-600 dark:text-purple-400",
	bootstrap_completed: "text-purple-600 dark:text-purple-400",
};

function renderDetailSummary(event: AuditEventDto) {
	if (event.event_type === "device_attestation_verified") {
		const legacy = event.detail.is_legacy_root === true;
		const level =
			typeof event.detail.key_security_level === "string"
				? event.detail.key_security_level
				: "unknown";
		const serial =
			typeof event.detail.root_serial_hex === "string"
				? event.detail.root_serial_hex
				: "unknown";
		return `${legacy ? "legacy" : "modern"} \u00b7 ${level} \u00b7 ${serial}`;
	}

	if (event.event_type === "device_attestation_failure") {
		const reason =
			typeof event.detail.reason === "string"
				? event.detail.reason
				: "unknown reason";
		return reason;
	}

	const keys = Object.keys(event.detail);
	return `${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "\u2026" : ""}`;
}

const columns: ColumnDef<AuditEventDto>[] = [
	{
		accessorKey: "created_at",
		header: "Timestamp",
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-sm">
				{new Date(row.original.created_at).toLocaleString()}
			</span>
		),
	},
	{
		accessorKey: "event_type",
		header: "Event",
		cell: ({ row }) => {
			const color =
				EVENT_TYPE_COLORS[row.original.event_type] ?? "text-muted-foreground";
			return (
				<Badge variant="outline" className={`font-mono text-xs ${color}`}>
					{row.original.event_type}
				</Badge>
			);
		},
	},
	{
		accessorKey: "actor_id",
		header: "Actor",
		cell: ({ row }) => (
			<span className="font-mono text-xs">
				{row.original.actor_id ? `${row.original.actor_id.slice(0, 8)}…` : "—"}
			</span>
		),
	},
	{
		accessorKey: "target_id",
		header: "Target",
		cell: ({ row }) => (
			<span className="font-mono text-xs">
				{row.original.target_id
					? `${row.original.target_id.slice(0, 8)}…`
					: "—"}
			</span>
		),
	},
	{
		accessorKey: "detail",
		header: "Detail",
		cell: ({ row }) => {
			return (
				<span className="text-xs text-muted-foreground">
					{renderDetailSummary(row.original)}
				</span>
			);
		},
	},
];

export function DataTableLogs({ data }: { data: AuditEventDto[] }) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 25 } },
	});

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No audit events found." />
			<div className="flex items-center justify-between px-2">
				<span className="text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} events
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
								{[25, 50, 100].map((n) => (
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
