"use client";

import { IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
	type ClassDto,
	createEnrollment,
	type UserExtendedDto,
} from "@/app/lib/api";
import {
	DataTableFilterOption,
	DataTableFilterSection,
	DataTableFilterSheet,
	DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
	getStoredPageSize,
} from "@/components/custom/data-table-shared";
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

function sortBySchoolId(a: UserExtendedDto, b: UserExtendedDto) {
	const aId = a.school_id ?? "";
	const bId = b.school_id ?? "";
	return aId.localeCompare(bId, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export function EnrollmentCreateClient({
	classes,
	students,
}: {
	classes: ClassDto[];
	students: UserExtendedDto[];
}) {
	const router = useRouter();
	const [classIds, setClassIds] = React.useState<string[]>([]);
	const [query, setQuery] = React.useState("");
	const [yearFilter, setYearFilter] = React.useState<number[]>([]);
	const [programFilter, setProgramFilter] = React.useState<string[]>([]);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = React.useState(false);
	const [pageIndex, setPageIndex] = React.useState(0);
	const [pageSize, setPageSize] = React.useState(getStoredPageSize);
	const chipsRef = useComboboxAnchor();

	const classOptions = React.useMemo(
		() =>
			classes.map((c) => ({
				value: c.id,
				label: `${c.course_code} - ${c.course_name}`,
			})),
		[classes],
	);

	const yearOptions = React.useMemo(() => {
		const values = new Set<number>();
		for (const student of students) {
			if (student.enrollment_year != null) values.add(student.enrollment_year);
		}
		return Array.from(values).sort((a, b) => a - b);
	}, [students]);

	const programOptions = React.useMemo(() => {
		const values = new Set<string>();
		for (const student of students) {
			if (student.program) values.add(student.program);
		}
		return Array.from(values).sort();
	}, [students]);

	const filteredStudents = React.useMemo(() => {
		const loweredQuery = query.trim().toLowerCase();
		return students
			.filter((student) => {
				if (
					yearFilter.length > 0 &&
					(student.enrollment_year == null ||
						!yearFilter.includes(student.enrollment_year))
				)
					return false;
				if (
					programFilter.length > 0 &&
					(!student.program || !programFilter.includes(student.program))
				)
					return false;
				if (!loweredQuery) return true;
				return (
					student.full_name.toLowerCase().includes(loweredQuery) ||
					(student.school_id ?? "").toLowerCase().includes(loweredQuery) ||
					student.email.toLowerCase().includes(loweredQuery)
				);
			})
			.sort(sortBySchoolId);
	}, [students, query, yearFilter, programFilter]);

	const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
	const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
	const pagedStudents = filteredStudents.slice(
		clampedPageIndex * pageSize,
		clampedPageIndex * pageSize + pageSize,
	);

	const allPageSelected =
		pagedStudents.length > 0 &&
		pagedStudents.every((s) => selectedIds.has(s.id));
	const somePageSelected = pagedStudents.some((s) => selectedIds.has(s.id));

	const toggleStudent = (studentId: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(studentId);
			else next.delete(studentId);
			return next;
		});
	};

	const toggleSelectPage = (checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			for (const student of pagedStudents) {
				if (checked) next.add(student.id);
				else next.delete(student.id);
			}
			return next;
		});
	};

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

	const handleSubmit = async () => {
		if (classIds.length === 0 || selectedIds.size === 0 || submitting) return;
		setSubmitting(true);
		try {
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

	const activeFilterCount =
		(yearFilter.length > 0 ? 1 : 0) + (programFilter.length > 0 ? 1 : 0);
	const classSummary =
		classIds.length === 0
			? "No classes selected"
			: `${classIds.length} class${classIds.length > 1 ? "es" : ""} selected`;

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link href="/enrollments" />}>
							Enrollments
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Create</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Create enrollments
				</h1>
				<p className="text-sm text-muted-foreground">
					Select classes and students, then enroll in batch.
				</p>
			</div>

			<FieldGroup className="max-w-4xl">
				<Field orientation="horizontal">
					<FieldContent>
						<FieldLabel>Classes</FieldLabel>
						<FieldDescription>
							Select one or more classes for this enrollment batch.
						</FieldDescription>
					</FieldContent>
					<div className="w-full space-y-2 md:max-w-2xl">
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

			<FieldSeparator className="max-w-4xl" />

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50" />
						<Input
							value={query}
							onChange={(e) => {
								setQuery(e.currentTarget.value);
								setPageIndex(0);
							}}
							placeholder="Search by name, school ID, or email"
							className="pl-8"
						/>
					</div>
					<DataTableFilterSheet
						title="Student filters"
						description="Refine the visible student list by enrollment year and program."
						contentClassName="sm:max-w-lg"
						activeCount={activeFilterCount}
						onReset={() => {
							setYearFilter([]);
							setProgramFilter([]);
							setPageIndex(0);
						}}
					>
						{yearOptions.length > 1 && (
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
						)}
						{programOptions.length > 1 && (
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
						)}
					</DataTableFilterSheet>
				</div>

				<div className="text-sm text-muted-foreground">
					{filteredStudents.length} visible · {selectedIds.size} selected
				</div>

				<div className="overflow-hidden rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">
									<div className="flex items-center justify-center">
										<Checkbox
											checked={allPageSelected}
											indeterminate={somePageSelected && !allPageSelected}
											onCheckedChange={(checked) => toggleSelectPage(!!checked)}
											aria-label="Select page students"
										/>
									</div>
								</TableHead>
								<TableHead>Student</TableHead>
								<TableHead>School ID</TableHead>
								<TableHead>Program</TableHead>
								<TableHead>Enrollment year</TableHead>
								<TableHead>Year level</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{pagedStudents.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-6 text-center text-sm text-muted-foreground"
									>
										No students match the current filters.
									</TableCell>
								</TableRow>
							) : (
								pagedStudents.map((student) => (
									<TableRow key={student.id}>
										<TableCell>
											<div className="flex items-center justify-center">
												<Checkbox
													checked={selectedIds.has(student.id)}
													onCheckedChange={(checked) =>
														toggleStudent(student.id, !!checked)
													}
													aria-label={`Select ${student.full_name}`}
												/>
											</div>
										</TableCell>
										<TableCell>
											<span className="font-medium">{student.full_name}</span>
										</TableCell>
										<TableCell className="font-mono text-xs">
											{student.school_id ?? "-"}
										</TableCell>
										<TableCell>{student.program ?? "—"}</TableCell>
										<TableCell>{student.enrollment_year ?? "—"}</TableCell>
										<TableCell>{student.year_level ?? "—"}</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>Rows per page</span>
						<Select
							value={String(pageSize)}
							onValueChange={(v) => {
								setPageSize(Number(v));
								setPageIndex(0);
							}}
						>
							<SelectTrigger className="h-8 w-16">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{DEFAULT_TABLE_PAGE_SIZE_OPTIONS.map((size) => (
										<SelectItem key={size} value={String(size)}>
											{size}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							Page {clampedPageIndex + 1} of {pageCount}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={clampedPageIndex === 0}
							onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={clampedPageIndex >= pageCount - 1}
							onClick={() =>
								setPageIndex((i) => Math.min(pageCount - 1, i + 1))
							}
						>
							Next
						</Button>
					</div>
				</div>
			</div>

			{selectedIds.size > 0 && (
				<div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-background px-4 py-3 shadow-sm">
					<div className="flex items-center gap-4">
						<span className="text-sm font-medium">
							{selectedIds.size} student{selectedIds.size > 1 ? "s" : ""}{" "}
							selected
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSelectedIds(new Set())}
						>
							Clear
						</Button>
					</div>
					<LoadingButton
						onClick={handleSubmit}
						disabled={classIds.length === 0}
						loading={submitting}
						loadingText="Creating…"
					>
						Create enrollments
					</LoadingButton>
				</div>
			)}
		</>
	);
}
