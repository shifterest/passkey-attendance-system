"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { CheckInSessionDto } from "@/app/lib/api";
import { closeSession } from "@/app/lib/api";
import {
	createDatabaseIdColumn,
	formatTableDateTime,
} from "@/components/custom/data-table-cells";
import {
	DataTableBody,
	DataTableRowActions,
	DataTableScaffold,
	DataTableToolbar,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { TransitionLink } from "@/components/custom/navigation-transition";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function DataTableSessions({ data }: { data: CheckInSessionDto[] }) {
	const router = useRouter();
	const [closedIds, setClosedIds] = React.useState<Set<string>>(new Set());
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "start_time", desc: true },
	]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({
			id: false,
		});

	const columns = React.useMemo<ColumnDef<CheckInSessionDto>[]>(
		() => [
			createDatabaseIdColumn<CheckInSessionDto>(),
			{
				accessorKey: "start_time",
				header: ({ column }) => (
					<SortableHeader column={column} label="Start" />
				),
				cell: ({ row }) => (
					<span className="whitespace-nowrap">
						{formatTableDateTime(row.original.start_time)}
					</span>
				),
			},
			{
				accessorKey: "end_time",
				header: ({ column }) => <SortableHeader column={column} label="End" />,
				cell: ({ row }) => (
					<span className="whitespace-nowrap">
						{formatTableDateTime(row.original.end_time)}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<SortableHeader column={column} label="Status" />
				),
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
										<TransitionLink
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
		state: { columnVisibility, sorting },
		onColumnVisibilityChange: setColumnVisibility,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<DataTableScaffold
			toolbarStart={
				<DataTableToolbar
					table={table}
					onSearch={() => {}}
					showSearch={false}
				/>
			}
		>
			<DataTableBody
				table={table}
				columnCount={columns.length}
				emptyMessage="No sessions found."
			/>
		</DataTableScaffold>
	);
}
