"use client";

import { IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
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
	createDatabaseIdColumn,
	RegistrationStatusBadge,
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
import { Checkbox } from "@/components/ui/checkbox";

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
	createDatabaseIdColumn<TeacherDto>(),
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
		header: ({ column }) => (
			<SortableHeader column={column} label="Registered" />
		),
		cell: ({ row }) => (
			<RegistrationStatusBadge registered={row.original.registered} />
		),
	},
	{
		accessorKey: "email",
		header: ({ column }) => <SortableHeader column={column} label="Email" />,
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.email}
			</span>
		),
	},
	{
		accessorKey: "has_open_session",
		filterFn: includesSomeFilter,
		header: ({ column }) => <SortableHeader column={column} label="Session" />,
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
		accessorKey: "default_policy",
		id: "policy",
		header: ({ column }) => <SortableHeader column={column} label="Policy" />,
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
			id: false,
			email: false,
		});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		getDefaultColumnFilters,
	);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: DEFAULT_TABLE_PAGE_SIZE,
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
				row.original.id.toLowerCase().includes(q) ||
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

	const activeFilterCount = React.useMemo(() => {
		const registrationValues = columnFilters.find((f) => f.id === "registered")
			?.value as boolean[] | undefined;
		const sessionValues = columnFilters.find((f) => f.id === "has_open_session")
			?.value as boolean[] | undefined;

		return (
			((registrationValues?.length ?? REGISTERED_FILTER_VALUES.length) <
			REGISTERED_FILTER_VALUES.length
				? 1
				: 0) +
			((sessionValues?.length ?? SESSION_FILTER_VALUES.length) <
			SESSION_FILTER_VALUES.length
				? 1
				: 0)
		);
	}, [columnFilters]);

	return (
		<DataTableScaffold
			toolbarStart={
				<DataTableToolbar
					table={table}
					onSearch={(q) => setGlobalFilter(q)}
					filters={
						<DataTableFilterSheet
							title="Teacher filters"
							description="Refine the teacher table by registered state and current session state."
							activeCount={activeFilterCount}
						>
							<DataTableFilterSection title="Registered">
								<DataTableFilterOption
									label="Registered"
									checked={isChecked("registered", true)}
									onCheckedChange={(checked) =>
										toggleFilterValue("registered", true, checked)
									}
								/>
								<DataTableFilterOption
									label="Unregistered"
									checked={isChecked("registered", false)}
									onCheckedChange={(checked) =>
										toggleFilterValue("registered", false, checked)
									}
								/>
							</DataTableFilterSection>
							<DataTableFilterSection title="Session">
								<DataTableFilterOption
									label="Active"
									checked={isChecked("has_open_session", true)}
									onCheckedChange={(checked) =>
										toggleFilterValue("has_open_session", true, checked)
									}
								/>
								<DataTableFilterOption
									label="Inactive"
									checked={isChecked("has_open_session", false)}
									onCheckedChange={(checked) =>
										toggleFilterValue("has_open_session", false, checked)
									}
								/>
							</DataTableFilterSection>
							<DataTableFilterActions>
								<DataTableFilterResetAction
									onClick={() => setColumnFilters(getDefaultColumnFilters())}
								/>
							</DataTableFilterActions>
						</DataTableFilterSheet>
					}
				/>
			}
		>
			<DataTableBody table={table} columnCount={columns.length} />
			<DataTablePagination table={table} />
		</DataTableScaffold>
	);
}
