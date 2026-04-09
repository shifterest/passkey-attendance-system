"use client";

import {
	IconAlertTriangle,
	IconCheck,
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconFilter,
	IconFlag,
	IconLayoutColumns,
	IconRefresh,
	IconShield,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { AttendanceRecordDto } from "@/app/lib/api";
import { approveRecord } from "@/app/lib/api";
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

function assuranceBand(
	score: number,
	standardThreshold: number | null,
	highThreshold: number | null,
) {
	const effectiveStandardThreshold = standardThreshold ?? 5;
	const effectiveHighThreshold = highThreshold ?? 9;
	if (score >= effectiveHighThreshold)
		return { label: "High", cls: "text-green-600 dark:text-green-400" };
	if (score >= effectiveStandardThreshold)
		return { label: "Standard", cls: "text-muted-foreground" };
	return { label: "Low", cls: "text-destructive" };
}

const MAX_METHODS = 3;

const columns: ColumnDef<AttendanceRecordDto>[] = [
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
			const band = assuranceBand(
				score,
				row.original.standard_threshold_recorded,
				row.original.high_threshold_recorded,
			);
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
							<IconFlag className="size-4 text-destructive" />
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
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "timestamp", desc: true },
	]);
	const [approvedIds, setApprovedIds] = React.useState<Set<string>>(new Set());
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<string[]>([
		"present",
		"late",
		"absent",
	]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 20,
	});

	const approveColumn = React.useMemo<ColumnDef<AttendanceRecordDto>>(
		() => ({
			id: "approve",
			header: "",
			cell: ({ row }) => {
				const r = row.original;
				if (r.manually_approved || approvedIds.has(r.id)) return null;
				const std = r.standard_threshold_recorded ?? 5;
				if (r.assurance_score >= std) return null;
				return (
					<Button
						size="xs"
						variant="outline"
						onClick={() => {
							setApprovedIds((prev) => new Set(prev).add(r.id));
							approveRecord(r.id).catch(() =>
								setApprovedIds((prev) => {
									const next = new Set(prev);
									next.delete(r.id);
									return next;
								}),
							);
						}}
					>
						Approve
					</Button>
				);
			},
		}),
		[approvedIds],
	);

	const allColumns = React.useMemo(
		() => [...columns, approveColumn],
		[approveColumn],
	);

	const filteredData = React.useMemo(() => {
		let result = data;
		if (statusFilter.length < 3) {
			result = result.filter((r) => statusFilter.includes(r.status));
		}
		if (globalFilter) {
			const q = globalFilter.toLowerCase();
			result = result.filter(
				(r) =>
					r.user_id.toLowerCase().includes(q) ||
					r.session_id.toLowerCase().includes(q),
			);
		}
		return result;
	}, [data, statusFilter, globalFilter]);

	const table = useReactTable({
		data: filteredData,
		columns: allColumns,
		state: { sorting, columnVisibility, rowSelection, pagination },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	const toggleStatus = (value: string, checked: boolean) => {
		setStatusFilter((prev) => {
			if (!checked && prev.includes(value) && prev.length === 1) return prev;
			return checked
				? Array.from(new Set([...prev, value]))
				: prev.filter((v) => v !== value);
		});
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
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Status</DropdownMenuLabel>
								{["present", "late", "absent"].map((s) => (
									<DropdownMenuCheckboxItem
										key={s}
										checked={statusFilter.includes(s)}
										onCheckedChange={(c) => toggleStatus(s, c)}
									>
										{s.charAt(0).toUpperCase() + s.slice(1)}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => setStatusFilter(["present", "late", "absent"])}
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
						<TableHeader className="bg-muted sticky top-0 z-10">
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
						<TableBody>
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
										colSpan={allColumns.length}
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
										{[10, 20, 50, 100].map((s) => (
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
