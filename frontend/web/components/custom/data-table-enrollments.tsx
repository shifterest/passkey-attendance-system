"use client";

import { IconFileImport, IconPlus, IconTrash } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
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
	type ClassEnrollmentDto,
	createEnrollment,
	deleteEnrollment,
	type UserExtendedDto,
} from "@/app/lib/api";
import {
	createDatabaseIdColumn,
	formatTableDate,
} from "@/components/custom/data-table-cells";
import {
	DataTableBody,
	DataTableFilterActions,
	DataTableFilterOption,
	DataTablePagination,
	DataTableRowActions,
	DataTableScaffold,
	DataTableFilterResetAction,
	DataTableFilterSection,
	DataTableFilterSheet,
	DataTableToolbar,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { EnrollmentManageDialog } from "@/components/custom/enrollment-manage-dialog";
import { ImportEnrollmentsDialog } from "@/components/custom/import-enrollments-dialog";
import { SetPageHeader } from "@/components/custom/page-header-context";
import {
	AlertDialog,
	AlertDialogAction,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function DataTableEnrollments({
	enrollments: initialEnrollments,
	classes,
	students,
	initialClassId,
}: {
	enrollments: ClassEnrollmentDto[];
	classes: ClassDto[];
	students: UserExtendedDto[];
	initialClassId?: string;
}) {
	const router = useRouter();
	const [enrollments, setEnrollments] = React.useState(initialEnrollments);
	const [openDialog, setOpenDialog] = React.useState(false);
	const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (statusMessage) {
			const timer = setTimeout(() => setStatusMessage(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [statusMessage]);
	const [query, setQuery] = React.useState("");
	const [classFilter, setClassFilter] = React.useState<string[]>([]);
	const [yearFilter, setYearFilter] = React.useState<number[]>([]);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({
			id: false,
		});

	const classById = React.useMemo(
		() => new Map(classes.map((classValue) => [classValue.id, classValue])),
		[classes],
	);
	const studentById = React.useMemo(
		() => new Map(students.map((student) => [student.id, student])),
		[students],
	);

	React.useEffect(() => {
		setEnrollments(initialEnrollments);
	}, [initialEnrollments]);

	React.useEffect(() => {
		const classId = initialClassId;
		if (classId && classById.has(classId)) {
			setOpenDialog(true);
		}
	}, [initialClassId, classById]);

	const yearOptions = React.useMemo(() => {
		const values = new Set<number>();
		for (const student of students) {
			if (student.enrollment_year !== null) {
				values.add(student.enrollment_year);
			}
		}
		return Array.from(values).sort((a, b) => a - b);
	}, [students]);

	const filtered = React.useMemo(() => {
		const loweredQuery = query.trim().toLowerCase();
		return enrollments.filter((enrollment) => {
			const classValue = classById.get(enrollment.class_id);
			const student = studentById.get(enrollment.student_id);
			if (!classValue || !student) {
				return false;
			}

			if (
				classFilter.length > 0 &&
				!classFilter.includes(enrollment.class_id)
			) {
				return false;
			}
			if (
				yearFilter.length > 0 &&
				(student.enrollment_year === null ||
					!yearFilter.includes(student.enrollment_year))
			) {
				return false;
			}
			if (!loweredQuery) {
				return true;
			}

			return (
				enrollment.id.toLowerCase().includes(loweredQuery) ||
				enrollment.student_id.toLowerCase().includes(loweredQuery) ||
				enrollment.class_id.toLowerCase().includes(loweredQuery) ||
				student.full_name.toLowerCase().includes(loweredQuery) ||
				(student.school_id ?? "").toLowerCase().includes(loweredQuery) ||
				classValue.course_code.toLowerCase().includes(loweredQuery) ||
				classValue.course_name.toLowerCase().includes(loweredQuery)
			);
		});
	}, [enrollments, classById, studentById, query, classFilter, yearFilter]);

	const handleDelete = React.useCallback(
		async (enrollmentId: string) => {
			await deleteEnrollment(enrollmentId);
			setEnrollments((previous) =>
				previous.filter((item) => item.id !== enrollmentId),
			);
			setStatusMessage("Enrollment removed.");
			router.refresh();
		},
		[router],
	);

	const handleCreateBatch = async (
		classIds: string[],
		studentIds: string[],
	) => {
		let added = 0;
		let skipped = 0;

		for (const classId of classIds) {
			for (const studentId of studentIds) {
				try {
					await createEnrollment({ class_id: classId, student_id: studentId });
					added += 1;
				} catch {
					skipped += 1;
				}
			}
		}

		setStatusMessage(
			`Enrollment complete. Added: ${added}. Skipped: ${skipped}.`,
		);
		router.refresh();
	};

	const columns = React.useMemo<ColumnDef<ClassEnrollmentDto>[]>(
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
			createDatabaseIdColumn<ClassEnrollmentDto>(),
			{
				id: "student_id",
				accessorFn: (row) =>
					studentById.get(row.student_id)?.full_name ?? row.student_id,
				header: ({ column }) => (
					<SortableHeader column={column} label="Student" />
				),
				cell: ({ row }) => {
					const student = studentById.get(row.original.student_id);
					if (!student) return "-";
					return (
						<div className="flex flex-col">
							<span className="font-medium">{student.full_name}</span>
							<span className="text-xs text-muted-foreground">
								{student.email}
							</span>
						</div>
					);
				},
			},
			{
				id: "school_id",
				accessorFn: (row) => studentById.get(row.student_id)?.school_id ?? "",
				header: ({ column }) => (
					<SortableHeader column={column} label="School ID" />
				),
				cell: ({ row }) => {
					const student = studentById.get(row.original.student_id);
					return (
						<span className="font-mono text-xs">
							{student?.school_id ?? "-"}
						</span>
					);
				},
			},
			{
				id: "enrollment_year",
				accessorFn: (row) =>
					studentById.get(row.student_id)?.enrollment_year ?? -1,
				header: ({ column }) => (
					<SortableHeader column={column} label="Enrollment Year" />
				),
				cell: ({ row }) => {
					const student = studentById.get(row.original.student_id);
					return student?.enrollment_year ?? "—";
				},
			},
			{
				id: "class_id",
				accessorFn: (row) => {
					const classValue = classById.get(row.class_id);
					return classValue
						? `${classValue.course_code} ${classValue.course_name}`
						: row.class_id;
				},
				header: ({ column }) => (
					<SortableHeader column={column} label="Class" />
				),
				cell: ({ row }) => {
					const classValue = classById.get(row.original.class_id);
					if (!classValue) return "-";
					return (
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="font-mono">
								{classValue.course_code}
							</Badge>
							<span>{classValue.course_name}</span>
						</div>
					);
				},
			},
			{
				id: "enrolled_at",
				header: ({ column }) => (
					<SortableHeader column={column} label="Enrolled" />
				),
				accessorFn: (row) => row.enrolled_at,
				cell: ({ row }) =>
					row.original.enrolled_at
						? formatTableDate(row.original.enrolled_at)
						: "—",
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DataTableRowActions>
						<DropdownMenuGroup>
							<AlertDialog>
								<AlertDialogTrigger
									render={
										<DropdownMenuItem
											onSelect={(event) => event.preventDefault()}
											variant="destructive"
										/>
									}
								>
									<IconTrash data-icon="inline-start" />
									Remove enrollment
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Remove enrollment?</AlertDialogTitle>
										<AlertDialogDescription>
											This removes the student from the class roster.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => handleDelete(row.original.id)}
										>
											Remove
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</DropdownMenuGroup>
					</DataTableRowActions>
				),
			},
		],
		[classById, studentById, handleDelete],
	);

	const table = useReactTable({
		data: filtered,
		columns,
		state: { sorting, columnVisibility, rowSelection },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 20 } },
	});

	const activeFilterCount = classFilter.length + yearFilter.length;

	return (
		<div className="flex flex-col gap-4">
			<EnrollmentManageDialog
				open={openDialog}
				onOpenChange={setOpenDialog}
				classes={classes}
				students={students}
				prefilledClassId={initialClassId}
				onSubmit={handleCreateBatch}
			/>
			<SetPageHeader
				title="Enrollments"
				description="Manage student-class enrollments."
				actions={
					<div className="flex items-center gap-2">
						<ImportEnrollmentsDialog
							trigger={
								<Button variant="outline" size="sm">
									<IconFileImport data-icon="inline-start" />
									Import
								</Button>
							}
						/>
						<Button size="sm" onClick={() => setOpenDialog(true)}>
							<IconPlus data-icon="inline-start" />
							Create
						</Button>
					</div>
				}
			/>
			{statusMessage && (
				<div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
					{statusMessage}
				</div>
			)}
			<DataTableScaffold
				toolbarStart={
					<DataTableToolbar
						table={table}
						onSearch={(q) => setQuery(q)}
						filters={
							<DataTableFilterSheet
								title="Enrollment filters"
								description="Refine enrollments by class and enrollment year."
								activeCount={activeFilterCount}
							>
								<DataTableFilterSection title="Class">
									{classes.map((classValue) => (
										<DataTableFilterOption
											key={classValue.id}
											label={classValue.course_code}
											checked={classFilter.includes(classValue.id)}
											onCheckedChange={(checked) =>
												setClassFilter((prev) =>
													checked
														? [...prev, classValue.id]
														: prev.filter((id) => id !== classValue.id),
												)
											}
										/>
									))}
								</DataTableFilterSection>
								<DataTableFilterSection title="Enrollment year">
									{yearOptions.map((year) => (
										<DataTableFilterOption
											key={year}
											label={String(year)}
											checked={yearFilter.includes(year)}
											onCheckedChange={(checked) =>
												setYearFilter((prev) =>
													checked
														? [...prev, year]
														: prev.filter((y) => y !== year),
												)
											}
										/>
									))}
								</DataTableFilterSection>
								<DataTableFilterActions>
									<DataTableFilterResetAction
										onClick={() => {
											setClassFilter([]);
											setYearFilter([]);
										}}
									/>
								</DataTableFilterActions>
							</DataTableFilterSheet>
						}
					/>
				}
			>
				<DataTableBody table={table} columnCount={columns.length} />
				<DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
			</DataTableScaffold>
		</div>
	);
}
