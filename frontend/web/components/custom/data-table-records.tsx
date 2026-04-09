"use client";

import {
	IconAlertTriangle,
	IconCheck,
	IconChevronDown,
	IconFilter,
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
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { AttendanceRecordDto } from "@/app/lib/api";
import { approveRecord } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
	SortableHeader,
} from "@/components/custom/data-table-shared";
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
		header: ({ column }) => (
			<SortableHeader column={column} label="Timestamp" />
		),
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
		header: ({ column }) => <SortableHeader column={column} label="Status" />,
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
		header: ({ column }) => <SortableHeader column={column} label="Score" />,
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
	const [bandFilter, setBandFilter] = React.useState<string[]>([
		"high",
		"standard",
		"low",
	]);
	const [flagFilter, setFlagFilter] = React.useState<string[]>([]);
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
		if (bandFilter.length < 3) {
			result = result.filter((r) => {
				const band = assuranceBand(
					r.assurance_score,
					r.standard_threshold_recorded,
					r.high_threshold_recorded,
				);
				return bandFilter.includes(band.label.toLowerCase());
			});
		}
		if (flagFilter.length > 0) {
			result = result.filter((r) => {
				if (flagFilter.includes("flagged") && r.is_flagged) return true;
				if (flagFilter.includes("approved") && r.manually_approved) return true;
				if (flagFilter.includes("sync_pending") && r.sync_pending) return true;
				if (flagFilter.includes("mock_gps") && r.gps_is_mock) return true;
				return false;
			});
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
	}, [data, statusFilter, bandFilter, flagFilter, globalFilter]);

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

	const toggleBand = (value: string, checked: boolean) => {
		setBandFilter((prev) => {
			if (!checked && prev.includes(value) && prev.length === 1) return prev;
			return checked
				? Array.from(new Set([...prev, value]))
				: prev.filter((v) => v !== value);
		});
	};

	const toggleFlag = (value: string, checked: boolean) => {
		setFlagFilter((prev) =>
			checked
				? Array.from(new Set([...prev, value]))
				: prev.filter((v) => v !== value),
		);
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
							<DropdownMenuGroup>
								<DropdownMenuLabel>Assurance Band</DropdownMenuLabel>
								{["high", "standard", "low"].map((b) => (
									<DropdownMenuCheckboxItem
										key={b}
										checked={bandFilter.includes(b)}
										onCheckedChange={(c) => toggleBand(b, c)}
									>
										{b.charAt(0).toUpperCase() + b.slice(1)}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>Flags</DropdownMenuLabel>
								{[
									{ key: "flagged", label: "Flagged" },
									{ key: "approved", label: "Manually approved" },
									{ key: "sync_pending", label: "Sync pending" },
									{ key: "mock_gps", label: "Mock GPS" },
								].map(({ key, label }) => (
									<DropdownMenuCheckboxItem
										key={key}
										checked={flagFilter.includes(key)}
										onCheckedChange={(c) => toggleFlag(key, c)}
									>
										{label}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => {
									setStatusFilter(["present", "late", "absent"]);
									setBandFilter(["high", "standard", "low"]);
									setFlagFilter([]);
								}}
							>
								Reset filters
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DataTableColumnVisibility table={table} />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<DataTableBody table={table} columnCount={allColumns.length} />
				<DataTablePagination
					table={table}
					pageSizeOptions={[10, 20, 50, 100]}
				/>
			</div>
		</div>
	);
}
