"use client";

import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { type ReactElement, useMemo, useState } from "react";
import {
	createSemester,
	deleteSemester,
	type SemesterDto,
	updateSemester,
} from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
	DataTableRowActions,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type SemesterFormState = {
	name: string;
	start_date: string;
	end_date: string;
	is_active: boolean;
};

const DEFAULT_FORM_STATE: SemesterFormState = {
	name: "",
	start_date: "",
	end_date: "",
	is_active: false,
};

function mergeSemesterRows(rows: SemesterDto[], next: SemesterDto) {
	const normalized = rows.map((row) => {
		if (next.is_active && row.id !== next.id) {
			return { ...row, is_active: false };
		}
		return row;
	});

	const existingIndex = normalized.findIndex((row) => row.id === next.id);
	if (existingIndex === -1) {
		return [next, ...normalized];
	}

	return normalized.map((row) => (row.id === next.id ? next : row));
}

function formatDate(value: string) {
	return new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function SemesterFormFields({
	values,
	onChange,
}: {
	values: SemesterFormState;
	onChange: (next: SemesterFormState) => void;
}) {
	return (
		<FieldGroup>
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor="semester-name">Semester name</FieldLabel>
					<FieldDescription>
						Use the academic term label shown throughout class management.
					</FieldDescription>
				</FieldContent>
				<Input
					id="semester-name"
					className="w-full md:w-72"
					value={values.name}
					onChange={(e) => onChange({ ...values, name: e.target.value })}
					placeholder="AY 2025-2026, 1st Semester"
				/>
			</Field>
			<FieldSeparator />
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor="semester-start">Start date</FieldLabel>
					<FieldDescription>
						Classes linked to this semester open sessions only inside its active
						window.
					</FieldDescription>
				</FieldContent>
				<Input
					id="semester-start"
					type="date"
					className="w-full md:w-48"
					value={values.start_date}
					onChange={(e) => onChange({ ...values, start_date: e.target.value })}
				/>
			</Field>
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor="semester-end">End date</FieldLabel>
					<FieldDescription>
						Closing date used for term-bound class scheduling.
					</FieldDescription>
				</FieldContent>
				<Input
					id="semester-end"
					type="date"
					className="w-full md:w-48"
					value={values.end_date}
					onChange={(e) => onChange({ ...values, end_date: e.target.value })}
				/>
			</Field>
			<FieldSeparator />
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor="semester-active">Active semester</FieldLabel>
					<FieldDescription>
						Mark this as the current semester and automatically deactivate any
						existing active term.
					</FieldDescription>
				</FieldContent>
				<Button
					id="semester-active"
					type="button"
					variant={values.is_active ? "default" : "outline"}
					size="sm"
					onClick={() => onChange({ ...values, is_active: !values.is_active })}
				>
					{values.is_active ? "Active" : "Inactive"}
				</Button>
			</Field>
		</FieldGroup>
	);
}

function CreateSemesterDialog({
	onCreated,
}: {
	onCreated: (semester: SemesterDto) => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [values, setValues] = useState<SemesterFormState>(DEFAULT_FORM_STATE);

	async function handleCreate() {
		setSubmitting(true);
		try {
			const semester = await createSemester(values);
			onCreated(semester);
			setValues(DEFAULT_FORM_STATE);
			setOpen(false);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				<IconPlus data-icon="inline-start" />
				Create
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create semester</DialogTitle>
					<DialogDescription>
						Add an academic term for semester-bound classes and attendance
						windows.
					</DialogDescription>
				</DialogHeader>
				<SemesterFormFields values={values} onChange={setValues} />
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						onClick={handleCreate}
						disabled={
							submitting ||
							!values.name.trim() ||
							!values.start_date ||
							!values.end_date
						}
					>
						{submitting ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function EditSemesterDialog({
	semester,
	trigger,
	onUpdated,
}: {
	semester: SemesterDto;
	trigger: ReactElement;
	onUpdated: (semester: SemesterDto) => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [values, setValues] = useState<SemesterFormState>({
		name: semester.name,
		start_date: semester.start_date,
		end_date: semester.end_date,
		is_active: semester.is_active,
	});

	async function handleSave() {
		setSubmitting(true);
		try {
			const updated = await updateSemester(semester.id, values);
			onUpdated(updated);
			setOpen(false);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={trigger} />
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit semester</DialogTitle>
					<DialogDescription>
						Update term dates and active status without leaving the table.
					</DialogDescription>
				</DialogHeader>
				<SemesterFormFields values={values} onChange={setValues} />
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						onClick={handleSave}
						disabled={
							submitting ||
							!values.name.trim() ||
							!values.start_date ||
							!values.end_date
						}
					>
						{submitting ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeleteSemesterDialog({
	semester,
	trigger,
	onDeleted,
}: {
	semester: SemesterDto;
	trigger: ReactElement;
	onDeleted: (semesterId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	async function handleDelete() {
		setSubmitting(true);
		try {
			await deleteSemester(semester.id);
			onDeleted(semester.id);
			setOpen(false);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={trigger} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete semester</DialogTitle>
					<DialogDescription>
						Remove {semester.name}. Classes linked to it will need a replacement
						term before session windows can be opened safely.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={submitting}
					>
						{submitting ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function DataTableSemesters({ data }: { data: SemesterDto[] }) {
	const [rows, setRows] = useState(data);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "start_date", desc: true },
	]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});

	const columns = useMemo<ColumnDef<SemesterDto>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <SortableHeader column={column} label="Name" />,
				cell: ({ row }) => (
					<div className="flex flex-col gap-1">
						<span className="font-medium">{row.original.name}</span>
						<span className="text-xs text-muted-foreground">
							{row.original.id.slice(0, 8)}
						</span>
					</div>
				),
			},
			{
				id: "status",
				accessorFn: (row) => (row.is_active ? "Active" : "Inactive"),
				header: ({ column }) => (
					<SortableHeader column={column} label="Status" />
				),
				cell: ({ row }) => (
					<Badge variant={row.original.is_active ? "default" : "outline"}>
						{row.original.is_active ? "Active" : "Inactive"}
					</Badge>
				),
			},
			{
				accessorKey: "start_date",
				header: ({ column }) => (
					<SortableHeader column={column} label="Start" />
				),
				cell: ({ row }) => formatDate(row.original.start_date),
			},
			{
				accessorKey: "end_date",
				header: ({ column }) => <SortableHeader column={column} label="End" />,
				cell: ({ row }) => formatDate(row.original.end_date),
			},
			{
				accessorKey: "created_at",
				header: ({ column }) => (
					<SortableHeader column={column} label="Created" />
				),
				cell: ({ row }) => formatDate(row.original.created_at),
			},
			{
				id: "actions",
				enableHiding: false,
				enableSorting: false,
				header: "Actions",
				cell: ({ row }) => (
					<DataTableRowActions>
						<DropdownMenuGroup>
							<EditSemesterDialog
								semester={row.original}
								trigger={
									<DropdownMenuItem
										onSelect={(event) => event.preventDefault()}
									>
										<IconPencil data-icon="inline-start" />
										Edit semester
									</DropdownMenuItem>
								}
								onUpdated={(semester) =>
									setRows((current) => mergeSemesterRows(current, semester))
								}
							/>
							<DeleteSemesterDialog
								semester={row.original}
								trigger={
									<DropdownMenuItem
										variant="destructive"
										onSelect={(event) => event.preventDefault()}
									>
										<IconTrash data-icon="inline-start" />
										Delete semester
									</DropdownMenuItem>
								}
								onDeleted={(semesterId) =>
									setRows((current) =>
										current.filter((item) => item.id !== semesterId),
									)
								}
							/>
						</DropdownMenuGroup>
					</DataTableRowActions>
				),
			},
		],
		[],
	);

	const table = useReactTable({
		data: rows,
		columns,
		state: {
			sorting,
			columnVisibility,
			globalFilter,
			pagination,
		},
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		globalFilterFn: (row, _columnId, value) => {
			const query = String(value).toLowerCase();
			return (
				row.original.name.toLowerCase().includes(query) ||
				row.original.start_date.toLowerCase().includes(query) ||
				row.original.end_date.toLowerCase().includes(query)
			);
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<SetPageHeader
				title="Semesters"
				description="Manage academic terms used by semester-bound classes and session windows."
				actions={
					<CreateSemesterDialog
						onCreated={(semester) =>
							setRows((current) => mergeSemesterRows(current, semester))
						}
					/>
				}
			/>
			<div className="flex items-center justify-between px-4 lg:px-6">
				<SearchForm onSearch={(query) => setGlobalFilter(query)} />
				<DataTableColumnVisibility table={table} />
			</div>
			<DataTableBody table={table} columnCount={columns.length} />
			<DataTablePagination table={table} />
		</div>
	);
}
