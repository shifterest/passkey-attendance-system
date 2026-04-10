"use client";

import { IconPlus } from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createEvent, type EventDto, type OrgDto } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
	DataTableScaffold,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { TransitionLink } from "@/components/custom/navigation-transition";
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

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-label";

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
				header: ({ column }) => <SortableHeader column={column} label="Name" />,
				cell: ({ row }) => {
					const event = row.original;
					return (
						<TransitionLink
							href={`/orgs/${event.org_id}/events/${event.id}`}
							className="font-medium hover:underline"
						>
							{event.name}
						</TransitionLink>
					);
				},
			},
			{
				accessorKey: "org_id",
				header: "Organization",
				cell: ({ row }) => {
					const org = orgMap.get(row.original.org_id);
					return org ? (
						<TransitionLink
							href={`/orgs/${org.id}`}
							className="hover:underline"
						>
							{org.name}
						</TransitionLink>
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
				header: ({ column }) => (
					<SortableHeader column={column} label="Created" />
				),
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
	const orgOptions = useMemo(
		() => orgs.map((org) => ({ value: org.id, label: org.name })),
		[orgs],
	);

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
											<SelectValue placeholder="Select an organization">
												{getSelectLabel(createOrgId, orgOptions)}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{orgOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
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
			<DataTableScaffold
				toolbarStart={<SearchForm onSearch={(q) => setGlobalFilter(q)} />}
				toolbarEnd={<DataTableColumnVisibility table={table} />}
			>
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} />
			</DataTableScaffold>
		</>
	);
}
