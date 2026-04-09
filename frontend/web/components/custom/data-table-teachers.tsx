"use client";

import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconCircle,
	IconCircleCheckFilled,
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
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import type { TeacherDto } from "@/app/lib/api";
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
		accessorKey: "full_name",
		header: "Full name",
		enableHiding: false,
		cell: ({ row }) => (
			<span className="font-medium">{row.original.full_name}</span>
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
		accessorKey: "school_id",
		header: "School ID",
		cell: ({ row }) => (
			<span className="font-mono text-sm">{row.original.school_id ?? "—"}</span>
		),
	},
	{
		accessorKey: "class_count",
		header: "Classes",
		cell: ({ row }) => (
			<span className="text-sm">{row.original.class_count}</span>
		),
	},
	{
		accessorKey: "student_count",
		header: "Students",
		cell: ({ row }) => (
			<span className="text-sm">{row.original.student_count}</span>
		),
	},
	{
		accessorKey: "has_open_session",
		filterFn: includesSomeFilter,
		header: "Session",
		cell: ({ row }) =>
			row.original.has_open_session ? (
				<Badge variant="default" className="gap-1 text-xs">
					<IconCircleCheckFilled />
					Active
				</Badge>
			) : (
				<Badge variant="secondary" className="gap-1 text-xs">
					<IconCircle />
					Inactive
				</Badge>
			),
	},
];

const getDefaultColumnFilters = (): ColumnFiltersState => [
	{ id: "has_open_session", value: [...SESSION_FILTER_VALUES] },
];

export function DataTableTeachers({
	data: initialData,
}: {
	data: TeacherDto[];
}) {
	const [data, setData] = React.useState(initialData);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
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
										{[10, 20, 30, 50].map((s) => (
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
