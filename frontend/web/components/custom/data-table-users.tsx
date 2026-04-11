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
import type { UserDto } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableFilterActions,
	DataTableFilterOption,
	DataTablePagination,
	DataTableScaffold,
	DataTableFilterResetAction,
	DataTableFilterSection,
	DataTableFilterSheet,
	DataTableToolbar,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import {
	createDatabaseIdColumn,
	RegistrationStatusBadge,
	UserRoleBadge,
} from "@/components/custom/data-table-cells";
import { Checkbox } from "@/components/ui/checkbox";

const ROLE_FILTER_VALUES = ["student", "teacher", "admin", "operator"] as const;

const includesSomeFilter: FilterFn<UserDto> = (row, columnId, filterValue) => {
	if (!Array.isArray(filterValue)) return true;
	return filterValue.includes(row.getValue(columnId));
};

const columns: ColumnDef<UserDto>[] = [
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
	createDatabaseIdColumn<UserDto>(),
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
		header: ({ column }) => (
			<SortableHeader column={column} label="Registration" />
		),
		cell: ({ row }) => (
			<RegistrationStatusBadge registered={row.original.registered} />
		),
	},
	{
		accessorKey: "role",
		filterFn: includesSomeFilter,
		header: ({ column }) => <SortableHeader column={column} label="Role" />,
		cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
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
];

const getDefaultColumnFilters = (): ColumnFiltersState => [
	{ id: "role", value: [...ROLE_FILTER_VALUES] },
];

export function DataTableUsers({ data: initialData }: { data: UserDto[] }) {
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
				row.original.id.toLowerCase().includes(q) ||
				row.original.full_name.toLowerCase().includes(q) ||
				row.original.role.toLowerCase().includes(q) ||
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
		value: string,
		checked: boolean,
	) => {
		setColumnFilters((prev) => {
			const existing = prev.find((f) => f.id === columnId);
			const values = Array.isArray(existing?.value)
				? (existing.value as string[])
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

	const isChecked = (columnId: string, value: string) => {
		const f = columnFilters.find((f) => f.id === columnId);
		return Array.isArray(f?.value)
			? (f.value as string[]).includes(value)
			: false;
	};

	const activeFilterCount = React.useMemo(() => {
		const roleValues = columnFilters.find((f) => f.id === "role")?.value as
			| string[]
			| undefined;

		return (roleValues?.length ?? ROLE_FILTER_VALUES.length) <
			ROLE_FILTER_VALUES.length
			? 1
			: 0;
	}, [columnFilters]);

	return (
		<DataTableScaffold
			toolbarStart={
				<DataTableToolbar
					table={table}
					onSearch={(q) => setGlobalFilter(q)}
					filters={
						<DataTableFilterSheet
							title="User filters"
							description="Refine the user table by role."
							activeCount={activeFilterCount}
						>
							<DataTableFilterSection title="Role">
								{ROLE_FILTER_VALUES.map((role) => (
									<DataTableFilterOption
										key={role}
										label={`${role.charAt(0).toUpperCase() + role.slice(1)}s`}
										checked={isChecked("role", role)}
										onCheckedChange={(checked) =>
											toggleFilterValue("role", role, checked)
										}
									/>
								))}
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
