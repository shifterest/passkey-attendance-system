"use client";

import {
	IconAlertTriangle,
	IconCheck,
	IconFlag,
	IconRefresh,
	IconShield,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { AttendanceRecordDto } from "@/app/lib/api";
import { approveRecord } from "@/app/lib/api";
import {
	createDatabaseIdColumn,
	DatabaseIdCell,
	formatTableDateTime,
} from "@/components/custom/data-table-cells";
import {
	DataTableBody,
	DataTableFilterActions,
	DataTableFilterOption,
	DataTableFilterResetAction,
	DataTableFilterSection,
	DataTableFilterSheet,
	DataTablePagination,
	DataTableScaffold,
	DataTableToolbar,
	DEFAULT_TABLE_PAGE_SIZE,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

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

function isRecordApprovable(
	record: AttendanceRecordDto,
	approvedIds: Set<string>,
) {
	if (record.manually_approved || approvedIds.has(record.id)) {
		return false;
	}

	const standardThreshold = record.standard_threshold_recorded ?? 5;
	return record.assurance_score < standardThreshold;
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
	createDatabaseIdColumn<AttendanceRecordDto>(),
	{
		accessorKey: "timestamp",
		header: ({ column }) => (
			<SortableHeader column={column} label="Timestamp" />
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap text-sm">
				{formatTableDateTime(row.original.timestamp)}
			</span>
		),
	},
	{
		accessorKey: "user_id",
		header: ({ column }) => <SortableHeader column={column} label="User ID" />,
		cell: ({ row }) => <DatabaseIdCell value={row.original.user_id} />,
	},
	{
		accessorKey: "session_id",
		header: ({ column }) => (
			<SortableHeader column={column} label="Session ID" />
		),
		cell: ({ row }) => <DatabaseIdCell value={row.original.session_id} />,
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
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({
			id: false,
			user_id: false,
			session_id: false,
		});
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
		pageSize: DEFAULT_TABLE_PAGE_SIZE,
	});
	const [isBulkApproving, setIsBulkApproving] = React.useState(false);

	const approveRecordIds = React.useCallback(async (recordIds: string[]) => {
		if (recordIds.length === 0) {
			return;
		}

		setIsBulkApproving(true);
		setApprovedIds((prev) => {
			const next = new Set(prev);
			for (const recordId of recordIds) {
				next.add(recordId);
			}
			return next;
		});

		const results = await Promise.allSettled(
			recordIds.map(async (recordId) => {
				await approveRecord(recordId);
				return recordId;
			}),
		);

		const failedIds = results.flatMap((result, index) =>
			result.status === "rejected" ? [recordIds[index]] : [],
		);

		if (failedIds.length > 0) {
			setApprovedIds((prev) => {
				const next = new Set(prev);
				for (const failedId of failedIds) {
					next.delete(failedId);
				}
				return next;
			});
		}

		setRowSelection((prev) => {
			const next = { ...prev };
			for (const recordId of recordIds) {
				if (!failedIds.includes(recordId)) {
					delete next[recordId];
				}
			}
			return next;
		});
		setIsBulkApproving(false);
	}, []);

	const approveColumn = React.useMemo<ColumnDef<AttendanceRecordDto>>(
		() => ({
			id: "actions",
			header: "",
			cell: ({ row }) => {
				const r = row.original;
				if (!isRecordApprovable(r, approvedIds)) return null;
				return (
					<div className="flex justify-end">
						<Button
							size="xs"
							variant="outline"
							onClick={() => void approveRecordIds([r.id])}
						>
							Approve
						</Button>
					</div>
				);
			},
		}),
		[approveRecordIds, approvedIds],
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
		getRowId: (row) => row.id,
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

	const approvableSelectedRecords = table
		.getFilteredSelectedRowModel()
		.rows.map((row) => row.original)
		.filter((record) => isRecordApprovable(record, approvedIds));

	const activeFilterCount =
		(statusFilter.length < 3 ? 1 : 0) +
		(bandFilter.length < 3 ? 1 : 0) +
		flagFilter.length;

	return (
		<DataTableScaffold
			toolbarStart={
				<DataTableToolbar
					table={table}
					onSearch={(q) => setGlobalFilter(q)}
					filters={
						<DataTableFilterSheet
							title="Record filters"
							description="Refine attendance records by status, assurance band, and flags."
							activeCount={activeFilterCount}
						>
							<DataTableFilterSection title="Status">
								{["present", "late", "absent"].map((status) => (
									<DataTableFilterOption
										key={status}
										label={status.charAt(0).toUpperCase() + status.slice(1)}
										checked={statusFilter.includes(status)}
										onCheckedChange={(checked) => toggleStatus(status, checked)}
									/>
								))}
							</DataTableFilterSection>
							<DataTableFilterSection title="Assurance band">
								{["high", "standard", "low"].map((band) => (
									<DataTableFilterOption
										key={band}
										label={band.charAt(0).toUpperCase() + band.slice(1)}
										checked={bandFilter.includes(band)}
										onCheckedChange={(checked) => toggleBand(band, checked)}
									/>
								))}
							</DataTableFilterSection>
							<DataTableFilterSection title="Flags">
								{[
									{ key: "flagged", label: "Flagged" },
									{ key: "approved", label: "Manually approved" },
									{ key: "sync_pending", label: "Sync pending" },
									{ key: "mock_gps", label: "Mock GPS" },
								].map(({ key, label }) => (
									<DataTableFilterOption
										key={key}
										label={label}
										checked={flagFilter.includes(key)}
										onCheckedChange={(checked) => toggleFlag(key, checked)}
									/>
								))}
							</DataTableFilterSection>
							<DataTableFilterActions>
								<DataTableFilterResetAction
									onClick={() => {
										setStatusFilter(["present", "late", "absent"]);
										setBandFilter(["high", "standard", "low"]);
										setFlagFilter([]);
									}}
								/>
							</DataTableFilterActions>
						</DataTableFilterSheet>
					}
				/>
			}
		>
			<DataTableBody table={table} columnCount={allColumns.length} />
			<DataTablePagination
				table={table}
				selectionActions={
					approvableSelectedRecords.length > 0 ? (
						<DropdownMenuItem
							disabled={isBulkApproving}
							onClick={() =>
								void approveRecordIds(
									approvableSelectedRecords.map((record) => record.id),
								)
							}
						>
							{isBulkApproving
								? "Approving..."
								: `Approve ${approvableSelectedRecords.length} low-assurance`}
						</DropdownMenuItem>
					) : null
				}
			/>
		</DataTableScaffold>
	);
}
