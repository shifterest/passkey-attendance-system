"use client";

import {
	IconChevronDown,
	IconDotsVertical,
	IconFilter,
	IconPencil,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
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
import { useRouter } from "next/navigation";
import * as React from "react";
import {
	type ClassDto,
	type ClassPolicyDto,
	createPolicy,
	deletePolicy,
	type TeacherDto,
	updatePolicy,
} from "@/app/lib/api";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTablePagination,
} from "@/components/custom/data-table-shared";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type PolicyScope = "system" | "teacher" | "class";

function getScope(policy: ClassPolicyDto): PolicyScope {
	if (policy.class_id) return "class";
	if (policy.created_by) return "teacher";
	return "system";
}

function getScopeLabel(scope: PolicyScope): string {
	if (scope === "system") return "System default";
	if (scope === "teacher") return "Teacher default";
	return "Class override";
}

const SCOPE_FILTER_VALUES: PolicyScope[] = ["system", "teacher", "class"];

const includesSomeFilter: FilterFn<ClassPolicyDto> = (
	row,
	_columnId,
	filterValue,
) => {
	if (!Array.isArray(filterValue)) return true;
	return filterValue.includes(getScope(row.original));
};

function PolicyFormFields({
	values,
	onChange,
}: {
	values: {
		standard_assurance_threshold: number;
		high_assurance_threshold: number;
		present_cutoff_minutes: number;
		late_cutoff_minutes: number;
		max_check_ins: number;
	};
	onChange: (field: string, value: number) => void;
}) {
	return (
		<FieldGroup>
			<div className="grid grid-cols-2 gap-4">
				<Field>
					<FieldLabel>Standard threshold</FieldLabel>
					<Input
						type="number"
						min={0}
						value={values.standard_assurance_threshold}
						onChange={(e) =>
							onChange(
								"standard_assurance_threshold",
								Number.parseInt(e.target.value, 10) || 0,
							)
						}
					/>
				</Field>
				<Field>
					<FieldLabel>High threshold</FieldLabel>
					<Input
						type="number"
						min={0}
						value={values.high_assurance_threshold}
						onChange={(e) =>
							onChange(
								"high_assurance_threshold",
								Number.parseInt(e.target.value, 10) || 0,
							)
						}
					/>
				</Field>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<Field>
					<FieldLabel>Present cutoff (min)</FieldLabel>
					<Input
						type="number"
						min={0}
						value={values.present_cutoff_minutes}
						onChange={(e) =>
							onChange(
								"present_cutoff_minutes",
								Number.parseInt(e.target.value, 10) || 0,
							)
						}
					/>
				</Field>
				<Field>
					<FieldLabel>Late cutoff (min)</FieldLabel>
					<Input
						type="number"
						min={0}
						value={values.late_cutoff_minutes}
						onChange={(e) =>
							onChange(
								"late_cutoff_minutes",
								Number.parseInt(e.target.value, 10) || 0,
							)
						}
					/>
				</Field>
			</div>
			<Field>
				<FieldLabel>Max check-ins per window</FieldLabel>
				<Input
					type="number"
					min={1}
					value={values.max_check_ins}
					onChange={(e) =>
						onChange("max_check_ins", Number.parseInt(e.target.value, 10) || 1)
					}
				/>
			</Field>
		</FieldGroup>
	);
}

function CreatePolicyDialog({
	classes,
	trigger,
	onCreated,
}: {
	classes: ClassDto[];
	trigger: React.ReactNode;
	onCreated: () => void;
}) {
	const [open, setOpen] = React.useState(false);
	const [scope, setScope] = React.useState<"system" | "class">("class");
	const [classId, setClassId] = React.useState<string>("");
	const [values, setValues] = React.useState({
		standard_assurance_threshold: 5,
		high_assurance_threshold: 9,
		present_cutoff_minutes: 5,
		late_cutoff_minutes: 15,
		max_check_ins: 3,
	});
	const [submitting, setSubmitting] = React.useState(false);

	const handleChange = (field: string, value: number) => {
		setValues((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			await createPolicy({
				class_id: scope === "class" ? classId : null,
				...values,
			});
			setOpen(false);
			onCreated();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={trigger} />
			<DialogContent>
				<DialogTitle>Create policy</DialogTitle>
				<DialogDescription>
					Set assurance thresholds and session window configuration.
				</DialogDescription>
				<FieldGroup>
					<Field>
						<FieldLabel>Scope</FieldLabel>
						<Select
							value={scope}
							onValueChange={(v) => setScope(v as "system" | "class")}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="system">System default</SelectItem>
									<SelectItem value="class">Class override</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					{scope === "class" && (
						<Field>
							<FieldLabel>Class</FieldLabel>
							<Select value={classId} onValueChange={setClassId}>
								<SelectTrigger>
									<SelectValue placeholder="Select a class" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{classes.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.course_code} — {c.course_name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					)}
				</FieldGroup>
				<PolicyFormFields values={values} onChange={handleChange} />
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						onClick={handleSubmit}
						disabled={submitting || (scope === "class" && !classId)}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function EditPolicyDialog({
	policy,
	trigger,
	onUpdated,
}: {
	policy: ClassPolicyDto;
	trigger: React.ReactNode;
	onUpdated: () => void;
}) {
	const [open, setOpen] = React.useState(false);
	const [values, setValues] = React.useState({
		standard_assurance_threshold: policy.standard_assurance_threshold,
		high_assurance_threshold: policy.high_assurance_threshold,
		present_cutoff_minutes: policy.present_cutoff_minutes,
		late_cutoff_minutes: policy.late_cutoff_minutes,
		max_check_ins: policy.max_check_ins,
	});
	const [submitting, setSubmitting] = React.useState(false);

	React.useEffect(() => {
		setValues({
			standard_assurance_threshold: policy.standard_assurance_threshold,
			high_assurance_threshold: policy.high_assurance_threshold,
			present_cutoff_minutes: policy.present_cutoff_minutes,
			late_cutoff_minutes: policy.late_cutoff_minutes,
			max_check_ins: policy.max_check_ins,
		});
	}, [policy]);

	const handleChange = (field: string, value: number) => {
		setValues((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			await updatePolicy(policy.id, values);
			setOpen(false);
			onUpdated();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={trigger} />
			<DialogContent>
				<DialogTitle>Edit policy</DialogTitle>
				<DialogDescription>
					Update assurance thresholds and session window configuration.
				</DialogDescription>
				<PolicyFormFields values={values} onChange={handleChange} />
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button onClick={handleSubmit} disabled={submitting}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeletePolicyDialog({
	policy,
	scopeLabel,
	trigger,
	onDeleted,
}: {
	policy: ClassPolicyDto;
	scopeLabel: string;
	trigger: React.ReactNode;
	onDeleted: () => void;
}) {
	const [open, setOpen] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);

	const handleDelete = async () => {
		setSubmitting(true);
		try {
			await deletePolicy(policy.id);
			setOpen(false);
			onDeleted();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={trigger} />
			<DialogContent>
				<DialogTitle>Delete policy</DialogTitle>
				<DialogDescription>
					This will permanently delete the {scopeLabel.toLowerCase()} policy.
					Classes using this policy will fall back to the next applicable
					default.
				</DialogDescription>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={submitting}
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function DataTablePolicies({
	policies: initialPolicies,
	classes,
	teachers,
}: {
	policies: ClassPolicyDto[];
	classes: ClassDto[];
	teachers: TeacherDto[];
}) {
	const router = useRouter();
	const [data, setData] = React.useState(initialPolicies);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		() => [{ id: "scope", value: [...SCOPE_FILTER_VALUES] }],
	);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});
	const [globalFilter, setGlobalFilter] = React.useState("");

	React.useEffect(() => {
		setData(initialPolicies);
	}, [initialPolicies]);

	const classMap = React.useMemo(() => {
		const m = new Map<string, ClassDto>();
		for (const c of classes) m.set(c.id, c);
		return m;
	}, [classes]);

	const teacherMap = React.useMemo(() => {
		const m = new Map<string, TeacherDto>();
		for (const t of teachers) m.set(t.id, t);
		return m;
	}, [teachers]);

	const refresh = React.useCallback(() => router.refresh(), [router]);

	const columns = React.useMemo<ColumnDef<ClassPolicyDto>[]>(
		() => [
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
							onCheckedChange={(value) =>
								table.toggleAllPageRowsSelected(!!value)
							}
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
				id: "scope",
				header: "Scope",
				filterFn: includesSomeFilter,
				accessorFn: (row) => getScope(row),
				cell: ({ row }) => {
					const scope = getScope(row.original);
					return (
						<Badge
							variant="outline"
							className="text-muted-foreground px-1.5 capitalize"
						>
							{getScopeLabel(scope)}
						</Badge>
					);
				},
			},
			{
				id: "target",
				header: "Target",
				cell: ({ row }) => {
					const scope = getScope(row.original);
					if (scope === "system")
						return (
							<span className="text-muted-foreground text-sm">All classes</span>
						);
					if (scope === "class" && row.original.class_id) {
						const cls = classMap.get(row.original.class_id);
						return cls ? (
							<span className="text-sm font-medium">
								{cls.course_code} — {cls.course_name}
							</span>
						) : (
							<span className="text-muted-foreground text-sm font-mono">
								{row.original.class_id}
							</span>
						);
					}
					if (scope === "teacher" && row.original.created_by) {
						const teacher = teacherMap.get(row.original.created_by);
						return teacher ? (
							<span className="text-sm font-medium">{teacher.full_name}</span>
						) : (
							<span className="text-muted-foreground text-sm font-mono">
								{row.original.created_by}
							</span>
						);
					}
					return <span className="text-muted-foreground text-sm">—</span>;
				},
			},
			{
				accessorKey: "standard_assurance_threshold",
				header: "Standard",
				cell: ({ row }) => (
					<span className="font-mono text-sm">
						≥{row.original.standard_assurance_threshold}
					</span>
				),
			},
			{
				accessorKey: "high_assurance_threshold",
				header: "High",
				cell: ({ row }) => (
					<span className="font-mono text-sm">
						≥{row.original.high_assurance_threshold}
					</span>
				),
			},
			{
				accessorKey: "present_cutoff_minutes",
				header: "Present cutoff",
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.present_cutoff_minutes} min
					</span>
				),
			},
			{
				accessorKey: "late_cutoff_minutes",
				header: "Late cutoff",
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.late_cutoff_minutes} min
					</span>
				),
			},
			{
				accessorKey: "max_check_ins",
				header: "Max check-ins",
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.max_check_ins}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const scope = getScope(row.original);
					const scopeLabel = getScopeLabel(scope);
					return (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="ghost" size="icon" />}
							>
								<IconDotsVertical />
								<span className="sr-only">Open menu</span>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuGroup>
									<EditPolicyDialog
										policy={row.original}
										trigger={
											<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
												<IconPencil className="mr-2 size-4" />
												Edit
											</DropdownMenuItem>
										}
										onUpdated={refresh}
									/>
									<DeletePolicyDialog
										policy={row.original}
										scopeLabel={scopeLabel}
										trigger={
											<DropdownMenuItem
												variant="destructive"
												onSelect={(e) => e.preventDefault()}
											>
												<IconTrash className="mr-2 size-4" />
												Delete
											</DropdownMenuItem>
										}
										onDeleted={refresh}
									/>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[classMap, teacherMap, refresh],
	);

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
			const scope = getScope(row.original);
			if (getScopeLabel(scope).toLowerCase().includes(q)) return true;
			if (scope === "class" && row.original.class_id) {
				const cls = classMap.get(row.original.class_id);
				if (
					cls &&
					(cls.course_code.toLowerCase().includes(q) ||
						cls.course_name.toLowerCase().includes(q))
				)
					return true;
			}
			if (scope === "teacher" && row.original.created_by) {
				const teacher = teacherMap.get(row.original.created_by);
				if (teacher?.full_name.toLowerCase().includes(q)) return true;
			}
			return false;
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

	return (
		<div className="flex flex-col gap-4">
			<SetPageHeader
				title="Policies"
				description="Assurance thresholds and session window configuration."
				actions={
					<CreatePolicyDialog
						classes={classes}
						trigger={
							<Button size="sm">
								<IconPlus data-icon="inline-start" />
								Create
							</Button>
						}
						onCreated={refresh}
					/>
				}
			/>
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
								<DropdownMenuLabel>Scope</DropdownMenuLabel>
								{SCOPE_FILTER_VALUES.map((scope) => (
									<DropdownMenuCheckboxItem
										key={scope}
										checked={isChecked("scope", scope)}
										onCheckedChange={(c) =>
											toggleFilterValue("scope", scope, c)
										}
									>
										{getScopeLabel(scope)}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() =>
									setColumnFilters([
										{ id: "scope", value: [...SCOPE_FILTER_VALUES] },
									])
								}
							>
								Reset filters
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DataTableColumnVisibility table={table} width="w-56" />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} />
			</div>
		</div>
	);
}
