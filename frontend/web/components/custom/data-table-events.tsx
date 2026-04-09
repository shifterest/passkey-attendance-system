"use client";

import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconLayoutColumns,
	IconPlus,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createEvent, type EventDto, type OrgDto } from "@/app/lib/api";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { SearchForm } from "@/components/custom/search-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export function DataTableEvents({
	events,
	orgs,
}: {
	events: EventDto[];
	orgs: OrgDto[];
}) {
	const [data] = useState(events);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const [globalFilter, setGlobalFilter] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createDesc, setCreateDesc] = useState("");
	const [createOrgId, setCreateOrgId] = useState(orgs[0]?.id ?? "");
	const [creating, setCreating] = useState(false);
	const router = useRouter();

	const orgMap = useMemo(() => {
		const m = new Map<string, OrgDto>();
		for (const o of orgs) m.set(o.id, o);
		return m;
	}, [orgs]);

	const columns: ColumnDef<EventDto>[] = useMemo(
		() => [
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
							onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
							aria-label="Select all"
						/>
					</div>
				),
				cell: ({ row }) => (
					<div className="flex w-8 items-center justify-center">
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={(v) => row.toggleSelected(!!v)}
							aria-label="Select row"
						/>
					</div>
				),
				enableSorting: false,
				enableHiding: false,
			},
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => {
					const event = row.original;
					return (
						<Link
							href={`/orgs/${event.org_id}/events/${event.id}`}
							className="font-medium hover:underline"
						>
							{event.name}
						</Link>
					);
				},
			},
			{
				accessorKey: "org_id",
				header: "Organization",
				cell: ({ row }) => {
					const org = orgMap.get(row.original.org_id);
					return org ? (
						<Link href={`/orgs/${org.id}`} className="hover:underline">
							{org.name}
						</Link>
					) : (
						<span className="text-muted-foreground">—</span>
					);
				},
			},
			{
				accessorKey: "description",
				header: "Description",
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.description ?? "—"}
					</span>
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
				accessorKey: "created_at",
				header: "Created",
				cell: ({ row }) =>
					new Date(row.original.created_at).toLocaleDateString(),
			},
		],
		[orgMap],
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			globalFilter,
			pagination,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		globalFilterFn: (row, _columnId, filterValue) => {
			const s = String(filterValue).toLowerCase();
			const e = row.original;
			const orgName = orgMap.get(e.org_id)?.name ?? "";
			return (
				e.name.toLowerCase().includes(s) ||
				(e.description ?? "").toLowerCase().includes(s) ||
				orgName.toLowerCase().includes(s)
			);
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	async function handleCreate() {
		if (!createName.trim() || !createOrgId || creating) return;
		setCreating(true);
		try {
			await createEvent(createOrgId, {
				name: createName.trim(),
				description: createDesc.trim() || undefined,
			});
			setCreateName("");
			setCreateDesc("");
			setCreateOpen(false);
			router.refresh();
		} finally {
			setCreating(false);
		}
	}

	return (
		<>
			<SetPageHeader
				title="Events"
				description="All events across organizations"
				actions={
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger render={<Button size="sm" />}>
							<IconPlus data-icon="inline-start" />
							Create
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create event</DialogTitle>
								<DialogDescription>
									Add a new event to an organization.
								</DialogDescription>
							</DialogHeader>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="create-event-org">
										Organization
									</FieldLabel>
									<Select
										value={createOrgId}
										onValueChange={(v) => {
											if (v !== null) setCreateOrgId(v);
										}}
									>
										<SelectTrigger id="create-event-org" className="w-full">
											<SelectValue placeholder="Select an organization" />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{orgs.map((o) => (
													<SelectItem key={o.id} value={o.id}>
														{o.name}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
								<Field>
									<FieldLabel htmlFor="create-event-name">Name</FieldLabel>
									<Input
										id="create-event-name"
										value={createName}
										onChange={(e) => setCreateName(e.target.value)}
										placeholder="Weekly Standup"
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="create-event-desc">
										Description (optional)
									</FieldLabel>
									<Input
										id="create-event-desc"
										value={createDesc}
										onChange={(e) => setCreateDesc(e.target.value)}
										placeholder="A short description of the event"
									/>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<DialogClose render={<Button variant="outline" />}>
									Cancel
								</DialogClose>
								<Button
									onClick={handleCreate}
									disabled={!createName.trim() || !createOrgId || creating}
								>
									{creating ? "Creating…" : "Create"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				}
			/>
			<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
				<div className="flex items-center justify-between px-4 lg:px-6">
					<SearchForm onSearch={(q) => setGlobalFilter(q)} />
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="outline" size="sm" />}
							>
								<IconLayoutColumns data-icon="inline-start" />
								Columns
								<IconChevronDown data-icon="inline-end" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{table
									.getAllColumns()
									.filter((c) => c.getCanHide())
									.map((c) => (
										<DropdownMenuCheckboxItem
											key={c.id}
											className="capitalize"
											checked={c.getIsVisible()}
											onCheckedChange={(v) => c.toggleVisibility(!!v)}
										>
											{c.id}
										</DropdownMenuCheckboxItem>
									))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<div className="overflow-hidden rounded-lg border mx-4 lg:mx-6">
					<Table>
						<TableHeader className="bg-muted sticky top-0 z-10 **:data-[slot=table-head]:first:w-8">
							{table.getHeaderGroups().map((hg) => (
								<TableRow key={hg.id}>
									{hg.headers.map((h) => (
										<TableHead key={h.id}>
											{h.isPlaceholder
												? null
												: flexRender(h.column.columnDef.header, h.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody className="**:data-[slot=table-cell]:first:w-8">
							{table.getRowModel().rows.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && "selected"}
									>
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
										No events found.
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
		</>
	);
}
