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
	createDatabaseIdColumn,
	formatTableDate,
} from "@/components/custom/data-table-cells";
import {
	DataTableBody,
	DataTablePagination,
	DataTableRowActions,
	DataTableScaffold,
	DataTableToolbar,
	getStoredPageSize,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import {
	FormSheet,
	FormSheetCancelButton,
} from "@/components/custom/form-sheet";
import { SetPageHeader } from "@/components/custom/page-header-context";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { LoadingButton } from "@/components/ui/loading-button";
import { Switch } from "@/components/ui/switch";

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

function SemesterFormFields({
	values,
	onChange,
}: {
	values: SemesterFormState;
	onChange: (next: SemesterFormState) => void;
}) {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="semester-name">Semester name</FieldLabel>
				<Input
					id="semester-name"
					value={values.name}
					onChange={(e) => onChange({ ...values, name: e.target.value })}
					placeholder="AY 2025-2026, 1st Semester"
				/>
			</Field>
			<FieldSeparator />
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor="semester-start">Start date</FieldLabel>
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
						Deactivates any other active term when enabled.
					</FieldDescription>
				</FieldContent>
				<Switch
					id="semester-active"
					checked={values.is_active}
					onCheckedChange={(checked) =>
						onChange({ ...values, is_active: checked })
					}
				/>
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
		<FormSheet
			open={open}
			onOpenChange={setOpen}
			trigger={
				<Button size="sm">
					<IconPlus data-icon="inline-start" />
					Create
				</Button>
			}
			title="Create semester"
			description="Add an academic term for semester-bound classes and attendance windows."
			contentClassName="sm:max-w-2xl"
			footer={
				<>
					<FormSheetCancelButton />
					<LoadingButton
						onClick={handleCreate}
						loading={submitting}
						loadingText="Creating…"
						disabled={
							!values.name.trim() || !values.start_date || !values.end_date
						}
					>
						Create
					</LoadingButton>
				</>
			}
		>
			<SemesterFormFields values={values} onChange={setValues} />
		</FormSheet>
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
		<FormSheet
			open={open}
			onOpenChange={setOpen}
			trigger={trigger}
			title="Edit semester"
			description="Update term dates and active status without leaving the table."
			contentClassName="sm:max-w-2xl"
			footer={
				<>
					<FormSheetCancelButton />
					<LoadingButton
						onClick={handleSave}
						loading={submitting}
						loadingText="Saving…"
						disabled={
							!values.name.trim() || !values.start_date || !values.end_date
						}
					>
						Save
					</LoadingButton>
				</>
			}
		>
			<SemesterFormFields values={values} onChange={setValues} />
		</FormSheet>
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
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={trigger} />
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete semester</AlertDialogTitle>
					<AlertDialogDescription>
						Remove {semester.name}. Classes linked to it will need a replacement
						term before session windows can be opened safely.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<LoadingButton
						onClick={handleDelete}
						loading={submitting}
						loadingText="Deleting…"
					>
						Delete
					</LoadingButton>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function DataTableSemesters({ data }: { data: SemesterDto[] }) {
	const [rows, setRows] = useState(data);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
		id: false,
	});
	const [globalFilter, setGlobalFilter] = useState("");
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: getStoredPageSize(),
	});

	const columns = useMemo<ColumnDef<SemesterDto>[]>(
		() => [
			createDatabaseIdColumn<SemesterDto>(),
			{
				accessorKey: "name",
				header: ({ column }) => <SortableHeader column={column} label="Name" />,
				cell: ({ row }) => (
					<span className="font-medium">{row.original.name}</span>
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
				cell: ({ row }) => formatTableDate(row.original.start_date),
			},
			{
				accessorKey: "end_date",
				header: ({ column }) => <SortableHeader column={column} label="End" />,
				cell: ({ row }) => formatTableDate(row.original.end_date),
			},
			{
				accessorKey: "created_at",
				header: ({ column }) => (
					<SortableHeader column={column} label="Created" />
				),
				cell: ({ row }) => formatTableDate(row.original.created_at),
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
										Edit
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
										Delete
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
				row.original.id.toLowerCase().includes(query) ||
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
			<DataTableScaffold
				toolbarStart={
					<DataTableToolbar
						table={table}
						onSearch={(query) => setGlobalFilter(query)}
					/>
				}
			>
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} />
			</DataTableScaffold>
		</div>
	);
}
