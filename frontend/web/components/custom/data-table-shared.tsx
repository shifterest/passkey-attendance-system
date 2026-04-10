"use client";

import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconDotsVertical,
	IconFilter,
	IconLayoutColumns,
	IconSelector,
	IconSortAscending,
	IconSortDescending,
} from "@tabler/icons-react";
import {
	type Column,
	flexRender,
	type Table as TanstackTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
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
import { cn } from "@/lib/utils";

export function columnIdToLabel(id: string): string {
	return id
		.replace(/_/g, " ")
		.replace(/\bid\b/g, "ID")
		.split(" ")
		.map((w) => (w === "ID" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
		.join(" ");
}

export function SortableHeader<TData>({
	column,
	label,
}: {
	column: Column<TData>;
	label: React.ReactNode;
}) {
	const sorted = column.getIsSorted();
	return (
		<Button
			variant="ghost"
			size="sm"
			className="-ml-3 h-8"
			onClick={() => {
				if (!sorted) column.toggleSorting(false);
				else if (sorted === "asc") column.toggleSorting(true);
				else column.clearSorting();
			}}
		>
			{label}
			{sorted === "asc" ? (
				<IconSortAscending className="ml-1 size-4" />
			) : sorted === "desc" ? (
				<IconSortDescending className="ml-1 size-4" />
			) : (
				<IconSelector className="ml-1 size-4" />
			)}
		</Button>
	);
}

export function DataTableColumnVisibility<TData>({
	table,
	width = "w-40",
}: {
	table: TanstackTable<TData>;
	width?: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
				<IconLayoutColumns data-icon="inline-start" />
				Columns
				<IconChevronDown data-icon="inline-end" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className={width}>
				{table
					.getAllColumns()
					.filter(
						(column) =>
							typeof column.accessorFn !== "undefined" && column.getCanHide(),
					)
					.map((column) => (
						<DropdownMenuCheckboxItem
							key={column.id}
							checked={column.getIsVisible()}
							onCheckedChange={(value) => column.toggleVisibility(!!value)}
						>
							{columnIdToLabel(column.id)}
						</DropdownMenuCheckboxItem>
					))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function DataTableFilterMenu({
	children,
	contentClassName = "w-48",
	label = "Filter",
	align = "end",
}: {
	children: ReactNode;
	contentClassName?: string;
	label?: string;
	align?: "center" | "end" | "start";
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
				<IconFilter data-icon="inline-start" />
				{label}
				<IconChevronDown data-icon="inline-end" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className={contentClassName}>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function DataTablePagination<TData>({
	table,
	pageSizeOptions = [10, 20, 30, 50],
	selectionActions,
}: {
	table: TanstackTable<TData>;
	pageSizeOptions?: number[];
	selectionActions?: ReactNode;
}) {
	const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;
	const filteredRowCount = table.getFilteredRowModel().rows.length;
	const hasSelection = selectedRowCount > 0;

	return (
		<div className="flex flex-col gap-3 px-4 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-muted-foreground">
					{selectedRowCount} of {filteredRowCount} row(s) selected.
				</span>
				{hasSelection ? (
					<>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => table.resetRowSelection()}
						>
							Clear selection
						</Button>
						{selectionActions}
					</>
				) : null}
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
								{pageSizeOptions.map((s) => (
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
	);
}

export function DataTableRowActions({
	children,
	label = "Open menu",
	contentClassName,
	align = "end",
}: {
	children: ReactNode;
	label?: string;
	contentClassName?: string;
	align?: "center" | "end" | "start";
}) {
	return (
		<div className="flex justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							className="data-open:bg-muted text-muted-foreground"
						/>
					}
				>
					<IconDotsVertical />
					<span className="sr-only">{label}</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align={align} className={contentClassName}>
					{children}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function getPinnedHeadClass(columnId: string) {
	if (columnId === "select") {
		return "sticky left-0 z-30 w-12 min-w-12 max-w-12 border-r bg-muted px-2";
	}

	if (columnId === "actions") {
		return "sticky right-0 z-30 w-14 min-w-14 max-w-14 border-l bg-muted px-2 text-right";
	}

	return "";
}

function getPinnedCellClass(columnId: string) {
	if (columnId === "select") {
		return "sticky left-0 z-20 w-12 min-w-12 max-w-12 border-r bg-background px-2 group-hover/table-row:bg-muted/50 group-data-[state=selected]/table-row:bg-muted";
	}

	if (columnId === "actions") {
		return "sticky right-0 z-20 w-14 min-w-14 max-w-14 border-l bg-background px-2 group-hover/table-row:bg-muted/50 group-data-[state=selected]/table-row:bg-muted";
	}

	return "";
}

export function DataTableBody<TData>({
	table,
	columnCount,
	emptyMessage = "No results.",
}: {
	table: TanstackTable<TData>;
	columnCount: number;
	emptyMessage?: string;
}) {
	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader className="bg-muted sticky top-0 z-10">
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead
									key={h.id}
									colSpan={h.colSpan}
									className={getPinnedHeadClass(h.column.id)}
								>
									{h.isPlaceholder ? null : h.column.id === "actions" ? (
										<span className="sr-only">Actions</span>
									) : (
										flexRender(h.column.columnDef.header, h.getContext())
									)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={cn(
											getPinnedCellClass(cell.column.id),
											cell.column.id === "actions" && "text-right",
										)}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={columnCount} className="h-24 text-center">
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
