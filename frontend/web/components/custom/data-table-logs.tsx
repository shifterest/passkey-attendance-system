"use client";

import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { AuditEventDto } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTableFilterMenu,
	DataTablePagination,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const EVENT_TYPE_COLORS: Record<string, string> = {
	manual_approval: "text-yellow-600 dark:text-yellow-400",
	manual_attendance: "text-yellow-600 dark:text-yellow-400",
	credential_revoked: "text-destructive",
	credential_unregistered: "text-destructive",
	credential_updated: "text-blue-600 dark:text-blue-400",
	device_attestation_failure: "text-destructive",
	device_attestation_verified: "text-blue-600 dark:text-blue-400",
	device_key_mismatch: "text-destructive",
	device_signature_failure: "text-destructive",
	sign_count_anomaly: "text-orange-500 dark:text-orange-400",
	bootstrap_attempt: "text-purple-600 dark:text-purple-400",
	bootstrap_completed: "text-purple-600 dark:text-purple-400",
	import_completed: "text-green-600 dark:text-green-400",
	registration_qr_issued: "text-blue-600 dark:text-blue-400",
	registration_qr_regenerated: "text-blue-600 dark:text-blue-400",
	enrollment_created: "text-green-600 dark:text-green-400",
	enrollment_updated: "text-blue-600 dark:text-blue-400",
	enrollment_deleted: "text-destructive",
	class_created: "text-green-600 dark:text-green-400",
	class_updated: "text-blue-600 dark:text-blue-400",
	class_deleted: "text-destructive",
	session_opened: "text-green-600 dark:text-green-400",
	session_closed: "text-orange-500 dark:text-orange-400",
	session_updated: "text-blue-600 dark:text-blue-400",
	session_deleted: "text-destructive",
	record_updated: "text-blue-600 dark:text-blue-400",
	record_deleted: "text-destructive",
	check_in_success: "text-green-600 dark:text-green-400",
	offline_sync_success: "text-green-600 dark:text-green-400",
	offline_signature_failure: "text-destructive",
	offline_record_escalated: "text-orange-500 dark:text-orange-400",
	org_created: "text-green-600 dark:text-green-400",
	org_updated: "text-blue-600 dark:text-blue-400",
	org_deleted: "text-destructive",
	org_membership_granted: "text-green-600 dark:text-green-400",
	org_membership_revoked: "text-destructive",
	org_rule_created: "text-green-600 dark:text-green-400",
	org_rule_deleted: "text-destructive",
	event_created: "text-green-600 dark:text-green-400",
	event_updated: "text-blue-600 dark:text-blue-400",
	event_deleted: "text-destructive",
	event_rule_created: "text-green-600 dark:text-green-400",
	event_rule_deleted: "text-destructive",
	user_created: "text-green-600 dark:text-green-400",
	user_updated: "text-blue-600 dark:text-blue-400",
	user_deleted: "text-destructive",
	policy_created: "text-green-600 dark:text-green-400",
	policy_updated: "text-blue-600 dark:text-blue-400",
	policy_deleted: "text-destructive",
	semester_created: "text-green-600 dark:text-green-400",
	semester_updated: "text-blue-600 dark:text-blue-400",
	semester_deleted: "text-destructive",
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

const includesSomeFilter: FilterFn<AuditEventDto> = (
	row,
	columnId,
	filterValue,
) => {
	if (!Array.isArray(filterValue)) return true;
	return filterValue.includes(row.getValue(columnId));
};

const columns: ColumnDef<AuditEventDto>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<div className="flex items-center justify-center">
				<Checkbox
					checked={table.getIsAllPageRowsSelected()}
					indeterminate={
						table.getIsSomePageRowsSelected() &&
						!table.getIsAllPageRowsSelected()
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
				/>
			</div>
		),
		cell: ({ row }) => (
			<div className="flex w-8 items-center justify-center">
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
				/>
			</div>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "created_at",
		header: ({ column }) => (
			<SortableHeader column={column} label="Timestamp" />
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-sm">
				{new Date(row.original.created_at).toLocaleString()}
			</span>
		),
	},
	{
		accessorKey: "event_type",
		filterFn: includesSomeFilter,
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

export function DataTableLogs({
	data: initialData,
}: {
	data: AuditEventDto[];
}) {
	const [data, setData] = React.useState(initialData);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "created_at", desc: true },
	]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 25,
	});
	const [globalFilter, setGlobalFilter] = React.useState("");

	React.useEffect(() => {
		setData(initialData);
	}, [initialData]);

	const eventTypes = React.useMemo(() => {
		const types = new Set<string>();
		for (const d of data) types.add(d.event_type);
		return Array.from(types).sort();
	}, [data]);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
			globalFilter,
		},
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		globalFilterFn: (row) => {
			const q = globalFilter.toLowerCase();
			return (
				row.original.event_type.toLowerCase().includes(q) ||
				(row.original.actor_id ?? "").toLowerCase().includes(q) ||
				(row.original.target_id ?? "").toLowerCase().includes(q)
			);
		},
		getRowId: (row) => row.id,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	const toggleFilterValue = (value: string, checked: boolean) => {
		setColumnFilters((prev) => {
			const existing = prev.find((f) => f.id === "event_type");
			const values = Array.isArray(existing?.value)
				? (existing.value as string[])
				: [...eventTypes];
			if (!checked && values.includes(value) && values.length === 1)
				return prev;
			const next = checked
				? Array.from(new Set([...values, value]))
				: values.filter((v) => v !== value);
			return [
				...prev.filter((f) => f.id !== "event_type"),
				{ id: "event_type", value: next },
			];
		});
	};

	const isChecked = (value: string) => {
		const f = columnFilters.find((f) => f.id === "event_type");
		if (!f) return true;
		return Array.isArray(f.value)
			? (f.value as string[]).includes(value)
			: true;
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between px-4 lg:px-6">
				<SearchForm onSearch={(q) => setGlobalFilter(q)} />
				<div className="flex items-center gap-2">
					<DataTableFilterMenu contentClassName="w-56 max-h-80 overflow-y-auto">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Event type</DropdownMenuLabel>
							{eventTypes.map((t) => (
								<DropdownMenuCheckboxItem
									key={t}
									checked={isChecked(t)}
									onCheckedChange={(c) => toggleFilterValue(t, c)}
								>
									{t}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() => setColumnFilters([])}
						>
							Reset filters
						</DropdownMenuItem>
					</DataTableFilterMenu>
					<DataTableColumnVisibility table={table} />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} pageSizeOptions={[25, 50, 100]} />
			</div>
		</div>
	);
}
