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
import { type ReactNode, useId } from "react";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
	registered: "Registered",
	has_open_session: "Session",
	ongoing_class: "Session",
	in_class: "Checked in",
	low_assurance: "Low assurance",
	event_type: "Event type",
	student_id: "Student",
	class_id: "Class",
	school_id: "School ID",
	enrolled_at: "Enrolled",
	enrollment_year: "Enrollment year",
};

export const DEFAULT_TABLE_PAGE_SIZE = 25;
export const DEFAULT_TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PAGE_SIZE_KEY = "pas_default_page_size";

export function getStoredPageSize(): number {
	if (typeof window === "undefined") return DEFAULT_TABLE_PAGE_SIZE;
	const stored = localStorage.getItem(PAGE_SIZE_KEY);
	if (stored) {
		const parsed = Number(stored);
		if (DEFAULT_TABLE_PAGE_SIZE_OPTIONS.includes(parsed)) return parsed;
	}
	return DEFAULT_TABLE_PAGE_SIZE;
}

export function columnIdToLabel(id: string): string {
	if (id in COLUMN_LABEL_OVERRIDES) {
		return COLUMN_LABEL_OVERRIDES[id];
	}

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
					.filter((column) => {
						const definition = column.columnDef;
						return (
							("accessorFn" in definition || "accessorKey" in definition) &&
							column.getCanHide()
						);
					})
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

export function DataTableFilterSheet({
	children,
	title = "Filters",
	description = "Refine the visible rows.",
	label = "Filters",
	contentClassName,
	activeCount = 0,
	onReset,
}: {
	children: ReactNode;
	title?: string;
	description?: string;
	label?: string;
	contentClassName?: string;
	activeCount?: number;
	onReset?: () => void;
}) {
	return (
		<Sheet>
			<SheetTrigger render={<Button variant="outline" size="sm" />}>
				<IconFilter data-icon="inline-start" />
				{label}
				{activeCount > 0 ? (
					<Badge variant="secondary" className="ml-1 px-1.5">
						{activeCount}
					</Badge>
				) : null}
			</SheetTrigger>
			<SheetContent
				side="right"
				className={cn("w-full p-0 sm:max-w-md", contentClassName)}
			>
				<SheetHeader className="gap-1 border-b">
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>{description}</SheetDescription>
				</SheetHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className="flex flex-col gap-6 p-6">{children}</div>
				</ScrollArea>
				{onReset && activeCount > 0 ? (
					<SheetFooter className="border-t">
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={onReset}
						>
							Reset filters
						</Button>
					</SheetFooter>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

export function DataTableFilterSection({
	title,
	children,
}: {
	title: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="space-y-1">
				<h3 className="font-medium text-foreground">{title}</h3>
			</div>
			<div className="flex flex-col gap-2">{children}</div>
		</div>
	);
}

export function DataTableFilterOption({
	label,
	checked,
	onCheckedChange,
}: {
	label: ReactNode;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	const inputId = useId();

	return (
		<label
			htmlFor={inputId}
			className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/40"
		>
			<Checkbox
				id={inputId}
				checked={checked}
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
			<span className="text-sm">{label}</span>
		</label>
	);
}

export function DataTableScaffold({
	toolbarStart,
	toolbarEnd,
	children,
	className,
	contentClassName,
}: {
	toolbarStart?: ReactNode;
	toolbarEnd?: ReactNode;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	const hasToolbar = toolbarStart || toolbarEnd;

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{hasToolbar ? (
				<div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
					{toolbarStart ? (
						<div className={cn("min-w-0", toolbarEnd ? undefined : "flex-1")}>
							{toolbarStart}
						</div>
					) : null}
					{toolbarEnd ? (
						<div className="ml-auto flex items-center gap-2">{toolbarEnd}</div>
					) : null}
				</div>
			) : null}
			<div
				className={cn(
					"relative flex flex-col gap-4 overflow-auto px-4 lg:px-6",
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

export function DataTableToolbar<TData>({
	table,
	onSearch,
	filters,
	columnVisibilityWidth,
	extraActions,
	showSearch = true,
}: {
	table: TanstackTable<TData>;
	onSearch: (query: string) => void;
	filters?: ReactNode;
	columnVisibilityWidth?: string;
	extraActions?: ReactNode;
	showSearch?: boolean;
}) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			{showSearch ? <SearchForm onSearch={onSearch} /> : null}
			<div className="ml-auto flex items-center gap-2">
				{filters}
				{extraActions}
				<DataTableColumnVisibility
					table={table}
					width={columnVisibilityWidth}
				/>
			</div>
		</div>
	);
}

export function DataTablePagination<TData>({
	table,
	pageSizeOptions = DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
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
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							Actions
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{selectionActions}
							{selectionActions ? <DropdownMenuSeparator /> : null}
							<DropdownMenuItem onClick={() => table.resetRowSelection()}>
								Clear selection
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
							size="icon"
							className="data-open:bg-muted text-muted-foreground size-8"
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
		return "sticky left-0 z-30 w-12 min-w-12 max-w-12 border-r bg-background px-2 [&>div]:mx-auto [&>div]:w-8 [&>div]:justify-center";
	}

	if (columnId === "actions") {
		return "sticky right-0 z-30 w-14 min-w-14 max-w-14 border-l bg-background px-2 text-right";
	}

	return "";
}

function getPinnedCellClass(columnId: string) {
	if (columnId === "select") {
		return "sticky left-0 z-20 w-12 min-w-12 max-w-12 border-r bg-background px-2 transition-colors group-hover/table-row:bg-muted group-data-[state=selected]/table-row:bg-muted [&>div]:mx-auto [&>div]:w-8 [&>div]:justify-center";
	}

	if (columnId === "actions") {
		return "sticky right-0 z-20 w-14 min-w-14 max-w-14 border-l bg-background px-2 transition-colors group-hover/table-row:bg-muted group-data-[state=selected]/table-row:bg-muted";
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
		<Table>
			<TableHeader className="sticky top-0 z-10 bg-background">
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
	);
}
