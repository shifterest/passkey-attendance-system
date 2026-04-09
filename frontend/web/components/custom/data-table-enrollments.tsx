"use client";

import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconDotsVertical,
	IconFileImport,
	IconFilter,
	IconLayoutColumns,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
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
import { EnrollmentManageDialog } from "@/components/custom/enrollment-manage-dialog";
import { ImportEnrollmentsDialog } from "@/components/custom/import-enrollments-dialog";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { SearchForm } from "@/components/custom/search-form";
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
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
	const [classFilter, setClassFilter] = React.useState<string[]>([]);
	const [yearFilter, setYearFilter] = React.useState<string[]>([]);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});

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
				classFilter.length > 0 &&
				!classFilter.includes(enrollment.class_id)
			) {
				return false;
			}
			if (
				yearFilter.length > 0 &&
				!yearFilter.includes(inferYear(student.school_id))
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
							render={<Button variant="ghost" size="icon" />}
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

	return (
		<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
			<EnrollmentManageDialog
				open={openDialog}
				onOpenChange={setOpenDialog}
				classes={classes}
				students={students}
				prefilledClassId={searchParams.get("class_id") ?? undefined}
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
			<div className="flex items-center justify-between">
				<SearchForm onSearch={(q) => setQuery(q)} />
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconFilter data-icon="inline-start" />
							Filter
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Class</DropdownMenuLabel>
								{classes.map((classValue) => (
									<DropdownMenuCheckboxItem
										key={classValue.id}
										checked={classFilter.includes(classValue.id)}
										onCheckedChange={(checked) =>
											setClassFilter((prev) =>
												checked
													? [...prev, classValue.id]
													: prev.filter((id) => id !== classValue.id),
											)
										}
									>
										{classValue.course_code}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>Year</DropdownMenuLabel>
								{yearOptions.map((year) => (
									<DropdownMenuCheckboxItem
										key={year}
										checked={yearFilter.includes(year)}
										onCheckedChange={(checked) =>
											setYearFilter((prev) =>
												checked
													? [...prev, year]
													: prev.filter((y) => y !== year),
											)
										}
									>
										{year}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							{(classFilter.length > 0 || yearFilter.length > 0) && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onClick={() => {
											setClassFilter([]);
											setYearFilter([]);
										}}
									>
										Reset filters
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconLayoutColumns data-icon="inline-start" />
							Columns
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							{table
								.getAllColumns()
								.filter(
									(column) =>
										typeof column.accessorFn !== "undefined" &&
										column.getCanHide(),
								)
								.map((column) => (
									<DropdownMenuCheckboxItem
										key={column.id}
										checked={column.getIsVisible()}
										onCheckedChange={(value) =>
											column.toggleVisibility(!!value)
										}
									>
										{column.id
											.replace(/_/g, " ")
											.replace(/\bid\b/g, "ID")
											.split(" ")
											.map((w) =>
												w === "ID" ? w : w.charAt(0).toUpperCase() + w.slice(1),
											)
											.join(" ")}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted sticky top-0 z-10 **:data-[slot=table-head]:first:w-8">
						{table.getHeaderGroups().map((hg) => (
							<TableRow key={hg.id}>
								{hg.headers.map((h) => (
									<TableHead key={h.id} colSpan={h.colSpan}>
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
								<TableRow key={row.id}>
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
									No enrollments found.
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
	);
}
