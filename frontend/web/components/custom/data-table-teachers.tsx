"use client";

import {
	IconChevronDown,
	IconCircle,
	IconCircleCheckFilled,
	IconCircleXFilled,
	IconFilter,
} from "@tabler/icons-react";
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
import type { TeacherDto } from "@/app/lib/api";
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

const REGISTERED_FILTER_VALUES = [true, false] as const;
const SESSION_FILTER_VALUES = [true, false] as const;

const includesSomeFilter: FilterFn<TeacherDto> = (
	row,
	columnId,
	filterValue,
) => {
	if (!Array.isArray(filterValue)) return true;
	return filterValue.includes(row.getValue(columnId));
};

const columns: ColumnDef<TeacherDto>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<div className="flex w-8 items-center justify-center">
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
		accessorKey: "full_name",
		header: ({ column }) => (
			<SortableHeader column={column} label="Full name" />
		),
		enableHiding: false,
		cell: ({ row }) => (
			<span className="font-medium">{row.original.full_name}</span>
		),
	},
	{
		accessorKey: "school_id",
		header: ({ column }) => (
			<SortableHeader column={column} label="School ID" />
		),
		cell: ({ row }) => (
			<span className="font-mono text-sm">{row.original.school_id ?? "—"}</span>
		),
	},
	{
		accessorKey: "registered",
		filterFn: includesSomeFilter,
		header: "Registration",
		cell: ({ row }) =>
			row.original.registered ? (
				<Badge className="border-green-200 bg-green-50 px-1.5 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
					<IconCircleCheckFilled />
					Registered
				</Badge>
			) : (
				<Badge className="border-red-200 bg-red-50 px-1.5 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					<IconCircleXFilled />
					Unregistered
				</Badge>
			),
	},
	{
		accessorKey: "email",
		header: "Email",
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.email}
			</span>
		),
	},
	{
		accessorKey: "has_open_session",
		filterFn: includesSomeFilter,
		header: "Session",
		cell: ({ row }) =>
			row.original.has_open_session ? (
				<Badge className="border-blue-200 bg-blue-50 px-1.5 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
					<IconCircleCheckFilled />
					Active
				</Badge>
			) : (
				<Badge variant="outline" className="px-1.5 text-muted-foreground">
					<IconCircle />
					Inactive
				</Badge>
			),
	},
	{
		accessorKey: "class_count",
		header: ({ column }) => <SortableHeader column={column} label="Classes" />,
		cell: ({ row }) => (
			<span className="text-sm">{row.original.class_count}</span>
		),
	},
	{
		accessorKey: "student_count",
		header: ({ column }) => <SortableHeader column={column} label="Students" />,
		cell: ({ row }) => (
			<span className="text-sm">{row.original.student_count}</span>
		),
	},
	{
		id: "policy",
		header: "Policy",
		cell: ({ row }) =>
			row.original.default_policy ? (
				<Badge variant="outline" className="px-1.5">
					Custom
				</Badge>
			) : (
				<span className="text-sm text-muted-foreground">Default</span>
			),
	},
];

const getDefaultColumnFilters = (): ColumnFiltersState => [
	{ id: "has_open_session", value: [...SESSION_FILTER_VALUES] },
	{ id: "registered", value: [...REGISTERED_FILTER_VALUES] },
];

export function DataTableTeachers({
	data: initialData,
}: {
	data: TeacherDto[];
}) {
	const [data, setData] = React.useState(initialData);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({
			email: false,
		});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		getDefaultColumnFilters,
	);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});
	const [globalFilter, setGlobalFilter] = React.useState("");

	React.useEffect(() => {
		setData(initialData);
	}, [initialData]);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			columnFilters,
			pagination,
			globalFilter,
		},
		globalFilterFn: (row) => {
			const q = globalFilter.toLowerCase();
			return (
				row.original.full_name.toLowerCase().includes(q) ||
				(row.original.school_id ?? "").toLowerCase().includes(q) ||
				row.original.email.toLowerCase().includes(q)
			);
		},
		getRowId: (row) => row.id,
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	const toggleFilterValue = (
		columnId: string,
		value: boolean,
		checked: boolean,
	) => {
		setColumnFilters((prev) => {
			const existing = prev.find((f) => f.id === columnId);
			const values = Array.isArray(existing?.value)
				? (existing.value as boolean[])
				: [];
			if (!checked && values.includes(value) && values.length === 1)
				return prev;
			const next = checked
				? Array.from(new Set([...values, value]))
				: values.filter((v) => v !== value);
			return [
				...prev.filter((f) => f.id !== columnId),
				{ id: columnId, value: next },
			];
		});
	};

	const isChecked = (columnId: string, value: boolean) => {
		const f = columnFilters.find((f) => f.id === columnId);
		return Array.isArray(f?.value)
			? (f.value as boolean[]).includes(value)
			: false;
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
								<DropdownMenuLabel>Registration</DropdownMenuLabel>
								<DropdownMenuCheckboxItem
									checked={isChecked("registered", true)}
									onCheckedChange={(c) =>
										toggleFilterValue("registered", true, c)
									}
								>
									Registered
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isChecked("registered", false)}
									onCheckedChange={(c) =>
										toggleFilterValue("registered", false, c)
									}
								>
									Unregistered
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>Session</DropdownMenuLabel>
								<DropdownMenuCheckboxItem
									checked={isChecked("has_open_session", true)}
									onCheckedChange={(c) =>
										toggleFilterValue("has_open_session", true, c)
									}
								>
									Active
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isChecked("has_open_session", false)}
									onCheckedChange={(c) =>
										toggleFilterValue("has_open_session", false, c)
									}
								>
									Inactive
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => setColumnFilters(getDefaultColumnFilters())}
							>
								Reset filters
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
