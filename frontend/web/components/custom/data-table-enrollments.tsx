"use client";

import {
	IconChevronLeft,
	IconChevronRight,
	IconDotsVertical,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
	type ClassDto,
	type ClassEnrollmentDto,
	createEnrollment,
	deleteEnrollment,
	type UserExtendedDto,
} from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { EnrollmentManageDialog } from "@/components/custom/enrollment-manage-dialog";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function inferYear(schoolId: string | null): string {
	if (!schoolId) return "Unknown";
	const value = schoolId.trim();
	if (value.length < 4) return "Unknown";
	const year = value.slice(0, 4);
	return /^\d{4}$/.test(year) ? year : "Unknown";
}

export function DataTableEnrollments({
	enrollments: initialEnrollments,
	classes,
	students,
}: {
	enrollments: ClassEnrollmentDto[];
	classes: ClassDto[];
	students: UserExtendedDto[];
}) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [enrollments, setEnrollments] = React.useState(initialEnrollments);
	const [openDialog, setOpenDialog] = React.useState(false);
	const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
	const [query, setQuery] = React.useState("");
	const [selectedClassFilter, setSelectedClassFilter] = React.useState("all");
	const [selectedYearFilter, setSelectedYearFilter] = React.useState("all");
	const [sorting, setSorting] = React.useState<SortingState>([]);

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
		const classId = searchParams.get("class_id");
		if (classId && classById.has(classId)) {
			setOpenDialog(true);
		}
	}, [searchParams, classById]);

	const yearOptions = React.useMemo(() => {
		const values = new Set<string>();
		for (const student of students) {
			values.add(inferYear(student.school_id));
		}
		return Array.from(values).sort();
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
				selectedClassFilter !== "all" &&
				enrollment.class_id !== selectedClassFilter
			) {
				return false;
			}
			if (
				selectedYearFilter !== "all" &&
				inferYear(student.school_id) !== selectedYearFilter
			) {
				return false;
			}
			if (!loweredQuery) {
				return true;
			}

			return (
				student.full_name.toLowerCase().includes(loweredQuery) ||
				(student.school_id ?? "").toLowerCase().includes(loweredQuery) ||
				classValue.course_code.toLowerCase().includes(loweredQuery) ||
				classValue.course_name.toLowerCase().includes(loweredQuery)
			);
		});
	}, [
		enrollments,
		classById,
		studentById,
		query,
		selectedClassFilter,
		selectedYearFilter,
	]);

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

	const handleCreateBatch = async (classId: string, studentIds: string[]) => {
		let added = 0;
		let skipped = 0;

		for (const studentId of studentIds) {
			try {
				await createEnrollment({ class_id: classId, student_id: studentId });
				added += 1;
			} catch {
				skipped += 1;
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
				accessorKey: "student_id",
				header: "Student",
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
				header: "School ID",
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
				id: "year",
				header: "Year",
				cell: ({ row }) => {
					const student = studentById.get(row.original.student_id);
					return inferYear(student?.school_id ?? null);
				},
			},
			{
				accessorKey: "class_id",
				header: "Class",
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
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="ghost" size="icon" className="size-8" />}
						>
							<IconDotsVertical />
							<span className="sr-only">Open menu</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
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
						</DropdownMenuContent>
					</DropdownMenu>
				),
			},
		],
		[classById, studentById, handleDelete],
	);

	const table = useReactTable({
		data: filtered,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 20 } },
	});

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<EnrollmentManageDialog
				open={openDialog}
				onOpenChange={setOpenDialog}
				classes={classes}
				students={students}
				prefilledClassId={searchParams.get("class_id") ?? undefined}
				onSubmit={handleCreateBatch}
			/>
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold">Enrollments</h2>
					<p className="text-sm text-muted-foreground">
						Manage class assignments for students.
					</p>
				</div>
				<Button type="button" onClick={() => setOpenDialog(true)}>
					<IconPlus data-icon="inline-start" />
					Create enrollment
				</Button>
			</div>
			{statusMessage && (
				<div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
					{statusMessage}
				</div>
			)}
			<FieldGroup className="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
				<Field>
					<FieldLabel htmlFor="enrollment-filter-query">Search</FieldLabel>
					<Input
						id="enrollment-filter-query"
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Student, school ID, class code"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="enrollment-filter-class">Class</FieldLabel>
					<Select
						value={selectedClassFilter}
						onValueChange={(value) => setSelectedClassFilter(value ?? "all")}
					>
						<SelectTrigger id="enrollment-filter-class" className="w-full">
							<SelectValue placeholder="All classes" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">All classes</SelectItem>
								{classes.map((classValue) => (
									<SelectItem key={classValue.id} value={classValue.id}>
										{classValue.course_code} - {classValue.course_name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor="enrollment-filter-year">Year</FieldLabel>
					<Select
						value={selectedYearFilter}
						onValueChange={(value) => setSelectedYearFilter(value ?? "all")}
					>
						<SelectTrigger id="enrollment-filter-year" className="w-full">
							<SelectValue placeholder="All years" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">All years</SelectItem>
								{yearOptions.map((year) => (
									<SelectItem key={year} value={year}>
										{year}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			</FieldGroup>
			<DataTable table={table} emptyMessage="No enrollments found." />
			<div className="flex items-center justify-between px-2">
				<span className="text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} enrollments
				</span>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<IconChevronLeft />
					</Button>
					<span className="text-sm text-muted-foreground">
						{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
					</span>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<IconChevronRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
