"use client";

import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconFilter,
	IconLayoutColumns,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { AuditEventDto } from "@/app/lib/api";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const EVENT_TYPE_COLORS: Record<string, string> = {
	manual_approval: "text-yellow-600 dark:text-yellow-400",
	credential_revoked: "text-destructive",
	device_attestation_failure: "text-destructive",
	device_attestation_verified: "text-blue-600 dark:text-blue-400",
	device_key_mismatch: "text-destructive",
	device_signature_failure: "text-destructive",
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
		header: "Timestamp",
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
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
			globalFilter,
		},
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
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
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconFilter data-icon="inline-start" />
							Filter
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-56 max-h-80 overflow-y-auto"
						>
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
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconLayoutColumns data-icon="inline-start" />
							Columns
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							{table
								.getAllColumns()
								.filter(
									(column) =>
										typeof column.accessorFn !== "undefined" &&
										column.getCanHide(),
								)
								.map((column) => (
									<DropdownMenuCheckboxItem
										key={column.id}
										checked={column.getIsVisible()}
										onCheckedChange={(value) =>
											column.toggleVisibility(!!value)
										}
									>
										{column.id
											.replace(/_/g, " ")
											.replace(/\bid\b/g, "ID")
											.split(" ")
											.map((w) =>
												w === "ID" ? w : w.charAt(0).toUpperCase() + w.slice(1),
											)
											.join(" ")}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="bg-muted sticky top-0 z-10 **:data-[slot=table-head]:first:w-8">
							{table.getHeaderGroups().map((hg) => (
								<TableRow key={hg.id}>
									{hg.headers.map((h) => (
										<TableHead key={h.id} colSpan={h.colSpan}>
											{h.isPlaceholder
												? null
												: flexRender(h.column.columnDef.header, h.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody className="**:data-[slot=table-cell]:first:w-8">
							{table.getRowModel().rows.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow key={row.id}>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No results.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
				<div className="flex items-center justify-between px-4">
					<div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
						{table.getFilteredSelectedRowModel().rows.length} of{" "}
						{table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex w-full items-center gap-8 lg:w-fit">
						<div className="hidden items-center gap-2 lg:flex">
							<Label htmlFor="rows-per-page" className="text-sm font-medium">
								Rows per page
							</Label>
							<Select
								value={`${table.getState().pagination.pageSize}`}
								onValueChange={(v) => table.setPageSize(Number(v))}
							>
								<SelectTrigger size="sm" className="w-20" id="rows-per-page">
									<SelectValue />
								</SelectTrigger>
								<SelectContent side="top">
									<SelectGroup>
										{[25, 50, 100].map((s) => (
											<SelectItem key={s} value={`${s}`}>
												{s}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex w-fit items-center justify-center text-sm font-medium">
							Page {table.getState().pagination.pageIndex + 1} of{" "}
							{table.getPageCount()}
						</div>
						<div className="ml-auto flex items-center gap-2 lg:ml-0">
							<Button
								variant="outline"
								className="hidden h-8 w-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(0)}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to first page</span>
								<IconChevronsLeft />
							</Button>
							<Button
								variant="outline"
								className="size-8"
								size="icon"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to previous page</span>
								<IconChevronLeft />
							</Button>
							<Button
								variant="outline"
								className="size-8"
								size="icon"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to next page</span>
								<IconChevronRight />
							</Button>
							<Button
								variant="outline"
								className="hidden size-8 lg:flex"
								size="icon"
								onClick={() => table.setPageIndex(table.getPageCount() - 1)}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to last page</span>
								<IconChevronsRight />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
