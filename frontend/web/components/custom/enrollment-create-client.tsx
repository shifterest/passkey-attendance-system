"use client";

import { IconPlus, IconStack2, IconX } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
	type ClassDto,
	createEnrollment,
	type UserExtendedDto,
} from "@/app/lib/api";
import {
	DataTableBody,
	DataTableFilterOption,
	DataTableFilterSection,
	DataTableFilterSheet,
	DataTablePagination,
	DataTableScaffold,
	DataTableToolbar,
	getStoredPageSize,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { SetPageHeader } from "@/components/custom/page-header-context";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { LoadingButton } from "@/components/ui/loading-button";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

const studentColumns: ColumnDef<UserExtendedDto>[] = [
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
	{
		accessorKey: "full_name",
		header: ({ column }) => (
			<SortableHeader column={column} label="Full name" />
		),
		enableHiding: false,
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
		accessorKey: "program",
		header: ({ column }) => <SortableHeader column={column} label="Program" />,
		cell: ({ row }) => row.original.program ?? "—",
	},
	{
		accessorKey: "enrollment_year",
		header: ({ column }) => (
			<SortableHeader column={column} label="Enrollment year" />
		),
		cell: ({ row }) => row.original.enrollment_year ?? "—",
	},
	{
		accessorKey: "year_level",
		header: ({ column }) => (
			<SortableHeader column={column} label="Year level" />
		),
		cell: ({ row }) => row.original.year_level ?? "—",
	},
];

const headerBreadcrumb = (
	<Breadcrumb>
		<BreadcrumbList>
			<BreadcrumbItem>
				<BreadcrumbLink render={<Link href="/enrollments" />}>
					Enrollments
				</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbPage className="font-heading text-base font-medium">
					Create
				</BreadcrumbPage>
			</BreadcrumbItem>
		</BreadcrumbList>
	</Breadcrumb>
);

export function EnrollmentCreateClient({
	classes,
	students,
}: {
	classes: ClassDto[];
	students: UserExtendedDto[];
}) {
	const router = useRouter();
	const [classIds, setClassIds] = React.useState<string[]>([]);
	const [submitting, setSubmitting] = React.useState(false);
	const [blockSize, setBlockSize] = React.useState(50);
	const [offset, setOffset] = React.useState(0);
	const chipsRef = useComboboxAnchor();

	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: getStoredPageSize(),
	});
	const [yearFilter, setYearFilter] = React.useState<number[]>([]);
	const [programFilter, setProgramFilter] = React.useState<string[]>([]);

	const classOptions = React.useMemo(
		() =>
			classes.map((c) => ({
				value: c.id,
				label: `${c.course_code} - ${c.course_name}`,
			})),
		[classes],
	);

	const yearOptions = React.useMemo(
		() =>
			[
				...new Set(
					students
						.map((s) => s.enrollment_year)
						.filter((y): y is number => y != null),
				),
			].sort((a, b) => a - b),
		[students],
	);

	const programOptions = React.useMemo(
		() =>
			[
				...new Set(
					students.map((s) => s.program).filter((p): p is string => p != null),
				),
			].sort(),
		[students],
	);

	const filteredData = React.useMemo(
		() =>
			students.filter((s) => {
				if (
					yearFilter.length > 0 &&
					(s.enrollment_year == null || !yearFilter.includes(s.enrollment_year))
				)
					return false;
				if (
					programFilter.length > 0 &&
					(!s.program || !programFilter.includes(s.program))
				)
					return false;
				return true;
			}),
		[students, yearFilter, programFilter],
	);

	const table = useReactTable({
		data: filteredData,
		columns: studentColumns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			pagination,
			globalFilter,
		},
		globalFilterFn: (row) => {
			const query = globalFilter.toLowerCase();
			return (
				row.original.full_name.toLowerCase().includes(query) ||
				(row.original.school_id ?? "").toLowerCase().includes(query) ||
				row.original.email.toLowerCase().includes(query) ||
				(row.original.program ?? "").toLowerCase().includes(query)
			);
		},
		getRowId: (row) => row.id,
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedCount = table.getFilteredSelectedRowModel().rows.length;

	const toggleYearFilter = (year: number, checked: boolean) => {
		setYearFilter((prev) => {
			if (prev.length === 0) {
				if (!checked) return yearOptions.filter((y) => y !== year);
				return prev;
			}
			if (checked) {
				const next = [...new Set([...prev, year])];
				if (yearOptions.every((y) => next.includes(y))) return [];
				return next;
			}
			if (prev.length === 1 && prev.includes(year)) return prev;
			return prev.filter((v) => v !== year);
		});
	};

	const toggleProgramFilter = (program: string, checked: boolean) => {
		setProgramFilter((prev) => {
			if (prev.length === 0) {
				if (!checked) return programOptions.filter((p) => p !== program);
				return prev;
			}
			if (checked) {
				const next = [...new Set([...prev, program])];
				if (programOptions.every((p) => next.includes(p))) return [];
				return next;
			}
			if (prev.length === 1 && prev.includes(program)) return prev;
			return prev.filter((v) => v !== program);
		});
	};

	const selectRange = () => {
		const allRows = table.getFilteredRowModel().rows;
		const boundedOffset = Math.max(offset, 0);
		const boundedSize = Math.max(blockSize, 1);
		const slice = allRows.slice(boundedOffset, boundedOffset + boundedSize);
		const next: Record<string, boolean> = {};
		for (const row of slice) {
			next[row.id] = true;
		}
		setRowSelection(next);
	};

	const activeFilterCount =
		(yearFilter.length > 0 ? 1 : 0) + (programFilter.length > 0 ? 1 : 0);

	const handleSubmit = async () => {
		if (classIds.length === 0 || selectedCount === 0 || submitting) return;
		setSubmitting(true);
		try {
			const selectedIds = table
				.getFilteredSelectedRowModel()
				.rows.map((r) => r.id);
			for (const classId of classIds) {
				for (const studentId of selectedIds) {
					try {
						await createEnrollment({
							class_id: classId,
							student_id: studentId,
						});
					} catch {
						// skip duplicates
					}
				}
			}
			router.push("/enrollments");
			router.refresh();
		} finally {
			setSubmitting(false);
		}
	};

	const classSummary =
		classIds.length === 0
			? "No classes selected"
			: `${classIds.length} class${classIds.length > 1 ? "es" : ""} selected`;

	return (
		<>
			<SetPageHeader
				title="Enrollments — Create"
				titleNode={headerBreadcrumb}
				actions={
					<LoadingButton
						size="sm"
						onClick={handleSubmit}
						disabled={classIds.length === 0 || selectedCount === 0}
						loading={submitting}
						loadingText="Creating…"
					>
						<IconPlus data-icon="inline-start" />
						Create
					</LoadingButton>
				}
			/>

			<FieldGroup className="px-4 lg:px-6">
				<Field>
					<FieldLabel>Classes</FieldLabel>
					<FieldDescription>
						Select one or more classes for this enrollment batch.
					</FieldDescription>
					<div className="w-full space-y-2">
						<Combobox multiple value={classIds} onValueChange={setClassIds}>
							<ComboboxChips ref={chipsRef}>
								{classIds.map((id) => {
									const option = classOptions.find((item) => item.value === id);
									return (
										<ComboboxChip key={id}>{option?.label ?? id}</ComboboxChip>
									);
								})}
								<ComboboxChipsInput placeholder="Search classes..." />
							</ComboboxChips>
							<ComboboxContent anchor={chipsRef}>
								<ComboboxList>
									<ComboboxEmpty>No classes found.</ComboboxEmpty>
									{classOptions.map((option) => (
										<ComboboxItem key={option.value} value={option.value}>
											{option.label}
										</ComboboxItem>
									))}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<p className="text-sm text-muted-foreground">{classSummary}</p>
					</div>
				</Field>
			</FieldGroup>

			<FieldSeparator className="mx-4 lg:mx-6" />

			<DataTableScaffold
				toolbarStart={
					<DataTableToolbar
						table={table}
						onSearch={(query) => setGlobalFilter(query)}
						extraActions={
							<Popover>
								<PopoverTrigger render={<Button variant="outline" size="sm" />}>
									<IconStack2 data-icon="inline-start" />
									Batch select
								</PopoverTrigger>
								<PopoverContent align="end" className="w-56">
									<div className="flex flex-col gap-3">
										<Field className="gap-1">
											<FieldLabel
												htmlFor="enrollment-block-size"
												className="text-xs"
											>
												Block size
											</FieldLabel>
											<NumberStepper
												id="enrollment-block-size"
												value={blockSize}
												onChange={setBlockSize}
												min={1}
												max={filteredData.length || 100}
											/>
										</Field>
										<Field className="gap-1">
											<FieldLabel
												htmlFor="enrollment-offset"
												className="text-xs"
											>
												Offset
											</FieldLabel>
											<NumberStepper
												id="enrollment-offset"
												value={offset}
												onChange={setOffset}
												min={0}
												step={10}
											/>
										</Field>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={selectRange}
										>
											Select range
										</Button>
									</div>
								</PopoverContent>
							</Popover>
						}
						filters={
							<DataTableFilterSheet
								title="Student filters"
								description="Refine the visible student list by enrollment year and program."
								contentClassName="sm:max-w-lg"
								activeCount={activeFilterCount}
								onReset={() => {
									setYearFilter([]);
									setProgramFilter([]);
								}}
							>
								{yearOptions.length > 1 ? (
									<DataTableFilterSection title="Enrollment year">
										{yearOptions.map((year) => (
											<DataTableFilterOption
												key={year}
												label={String(year)}
												checked={
													yearFilter.length === 0 || yearFilter.includes(year)
												}
												onCheckedChange={(checked) =>
													toggleYearFilter(year, checked)
												}
											/>
										))}
									</DataTableFilterSection>
								) : null}
								{programOptions.length > 1 ? (
									<DataTableFilterSection title="Program">
										{programOptions.map((program) => (
											<DataTableFilterOption
												key={program}
												label={program}
												checked={
													programFilter.length === 0 ||
													programFilter.includes(program)
												}
												onCheckedChange={(checked) =>
													toggleProgramFilter(program, checked)
												}
											/>
										))}
									</DataTableFilterSection>
								) : null}
							</DataTableFilterSheet>
						}
					/>
				}
			>
				<DataTableBody table={table} columnCount={studentColumns.length} />
				<DataTablePagination
					table={table}
					selectionActions={
						<DropdownMenuItem onClick={() => table.resetRowSelection()}>
							<IconX data-icon="inline-start" />
							Clear selection
						</DropdownMenuItem>
					}
				/>
			</DataTableScaffold>
		</>
	);
}
