"use client";

import { IconCalendar } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ClassDto, TeacherDto } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
	DataTableRowActions,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { useNavigationTransition } from "@/components/custom/navigation-transition";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

function formatSchedule(schedule: ClassDto["schedule"]) {
	return schedule
		.map((s) => `${s.days.join(", ")} ${s.start_time}–${s.end_time}`)
		.join("; ");
}

export function DataTableClasses({
	data: initialData,
	teachers = [],
}: {
	data: ClassDto[];
	teachers?: TeacherDto[];
}) {
	const router = useRouter();
	const transition = useNavigationTransition();
	const teacherMap = React.useMemo(
		() => new Map(teachers.map((t) => [t.id, t.full_name])),
		[teachers],
	);
	const [data, setData] = React.useState(initialData);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});
	const [globalFilter, setGlobalFilter] = React.useState("");

	React.useEffect(() => {
		setData(initialData);
	}, [initialData]);

	const columns = React.useMemo<ColumnDef<ClassDto>[]>(
		() => [
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
							onCheckedChange={(value) =>
								table.toggleAllPageRowsSelected(!!value)
							}
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
				accessorKey: "course_code",
				header: ({ column }) => <SortableHeader column={column} label="Code" />,
				cell: ({ row }) => (
					<Badge variant="outline" className="font-mono">
						{row.original.course_code}
					</Badge>
				),
			},
			{
				accessorKey: "course_name",
				header: ({ column }) => (
					<SortableHeader column={column} label="Course name" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.course_name}</span>
				),
			},
			{
				id: "teacher",
				header: "Teacher",
				cell: ({ row }) => (
					<span className="text-sm">
						{row.original.teacher_id
							? (teacherMap.get(row.original.teacher_id) ??
								row.original.teacher_id)
							: "—"}
					</span>
				),
			},
			{
				accessorKey: "schedule",
				header: "Schedule",
				cell: ({ row }) => (
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<IconCalendar className="size-4 shrink-0" />
						{formatSchedule(row.original.schedule)}
					</div>
				),
			},
			{
				id: "thresholds",
				header: "Thresholds",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						Standard ≥{row.original.standard_assurance_threshold} · High ≥
						{row.original.high_assurance_threshold}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DataTableRowActions>
						<DropdownMenuGroup>
							<DropdownMenuItem
								onClick={() => {
									transition?.beginNavigation();
									router.push(`/classes/${row.original.id}/sessions`);
								}}
							>
								Sessions
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									transition?.beginNavigation();
									router.push(`/enrollments?class_id=${row.original.id}`);
								}}
							>
								Manage enrollment
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DataTableRowActions>
				),
			},
		],
		[router, teacherMap, transition],
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			pagination,
			globalFilter,
		},
		globalFilterFn: (row) => {
			const q = globalFilter.toLowerCase();
			return (
				row.original.course_code.toLowerCase().includes(q) ||
				row.original.course_name.toLowerCase().includes(q)
			);
		},
		getRowId: (row) => row.id,
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between px-4 lg:px-6">
				<SearchForm onSearch={(q) => setGlobalFilter(q)} />
				<div className="flex items-center gap-2">
					<DataTableColumnVisibility table={table} />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} />
			</div>
		</div>
	);
}
