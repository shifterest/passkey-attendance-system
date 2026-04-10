"use client";

import { IconFileImport, IconPlus, IconTrash } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { OrgDto } from "@/app/lib/api";
import { createOrg, deleteOrg } from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
	DataTableRowActions,
	DataTableScaffold,
} from "@/components/custom/data-table-shared";
import { ImportOrgsDialog } from "@/components/custom/import-orgs-dialog";
import {
	TransitionLink,
	useNavigationTransition,
} from "@/components/custom/navigation-transition";
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
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const columns: ColumnDef<OrgDto>[] = [
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
		accessorKey: "name",
		header: "Name",
		cell: ({ row }) => (
			<TransitionLink
				href={`/orgs/${row.original.id}`}
				className="font-medium hover:underline"
			>
				{row.original.name}
			</TransitionLink>
		),
	},
	{
		accessorKey: "description",
		header: "Description",
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.description || "—"}
			</span>
		),
	},
];

export function OrgList({ data: initialData }: { data: OrgDto[] }) {
	const router = useRouter();
	const transition = useNavigationTransition();
	const [data, setData] = React.useState(initialData);
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [createOpen, setCreateOpen] = React.useState(false);
	const [name, setName] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [creating, setCreating] = React.useState(false);

	React.useEffect(() => {
		setData(initialData);
	}, [initialData]);

	async function handleCreate() {
		if (!name.trim() || creating) return;
		setCreating(true);
		try {
			await createOrg({
				name: name.trim(),
				description: description.trim() || undefined,
			});
			setName("");
			setDescription("");
			setCreateOpen(false);
			router.refresh();
		} finally {
			setCreating(false);
		}
	}

	const handleDelete = React.useCallback(
		async (orgId: string) => {
			await deleteOrg(orgId);
			router.refresh();
		},
		[router],
	);

	const actionsColumn = React.useMemo<ColumnDef<OrgDto>>(
		() => ({
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<DataTableRowActions>
					<DropdownMenuGroup>
						<DropdownMenuItem
							onClick={() => {
								transition?.beginNavigation();
								router.push(`/orgs/${row.original.id}`);
							}}
						>
							View
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onClick={() => handleDelete(row.original.id)}
						>
							<IconTrash data-icon="inline-start" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DataTableRowActions>
			),
		}),
		[handleDelete, router, transition],
	);

	const allColumns = React.useMemo(
		() => [...columns, actionsColumn],
		[actionsColumn],
	);

	const table = useReactTable({
		data,
		columns: allColumns,
		state: { pagination, globalFilter, columnVisibility, rowSelection },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onColumnVisibilityChange: setColumnVisibility,
		globalFilterFn: (row) => {
			const q = globalFilter.toLowerCase();
			return (
				row.original.name.toLowerCase().includes(q) ||
				(row.original.description ?? "").toLowerCase().includes(q)
			);
		},
		getRowId: (row) => row.id,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<div className="flex flex-col gap-4">
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<SetPageHeader
					title="Organizations"
					description="Manage organizations and membership-based attendance."
					actions={
						<div className="flex items-center gap-2">
							<ImportOrgsDialog
								trigger={
									<Button variant="outline" size="sm">
										<IconFileImport data-icon="inline-start" />
										Import
									</Button>
								}
							/>
							<DialogTrigger render={<Button size="sm" />}>
								<IconPlus data-icon="inline-start" />
								Create
							</DialogTrigger>
						</div>
					}
				/>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create organization</DialogTitle>
						<DialogDescription>
							Add a new organization to manage membership-based attendance.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="org-name">Name</FieldLabel>
							<Input
								id="org-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Organization name"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="org-desc">Description (optional)</FieldLabel>
							<Input
								id="org-desc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Short description"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							Cancel
						</DialogClose>
						<Button onClick={handleCreate} disabled={creating || !name.trim()}>
							{creating ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<DataTableScaffold
				toolbarStart={<SearchForm onSearch={(q) => setGlobalFilter(q)} />}
				toolbarEnd={<DataTableColumnVisibility table={table} />}
			>
				<DataTableBody
					table={table}
					columnCount={allColumns.length}
					emptyMessage="No organizations found."
				/>
				<DataTablePagination table={table} />
			</DataTableScaffold>
		</div>
	);
}
