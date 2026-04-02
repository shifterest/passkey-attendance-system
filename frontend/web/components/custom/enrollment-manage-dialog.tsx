"use client";

import { IconSearch } from "@tabler/icons-react";
import * as React from "react";
import type { ClassDto, UserExtendedDto } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes: ClassDto[];
	students: UserExtendedDto[];
	prefilledClassId?: string;
	onSubmit: (classId: string, studentIds: string[]) => Promise<void>;
};

function inferYear(schoolId: string | null): string {
	if (!schoolId) return "Unknown";
	const value = schoolId.trim();
	if (value.length < 4) return "Unknown";
	const year = value.slice(0, 4);
	return /^\d{4}$/.test(year) ? year : "Unknown";
}

function sortBySchoolId(a: UserExtendedDto, b: UserExtendedDto) {
	const aId = a.school_id ?? "";
	const bId = b.school_id ?? "";
	return aId.localeCompare(bId, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export function EnrollmentManageDialog({
	open,
	onOpenChange,
	classes,
	students,
	prefilledClassId,
	onSubmit,
}: Props) {
	const [classId, setClassId] = React.useState(prefilledClassId ?? "");
	const [query, setQuery] = React.useState("");
	const [yearFilter, setYearFilter] = React.useState("all");
	const [blockSize, setBlockSize] = React.useState(50);
	const [offset, setOffset] = React.useState(0);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = React.useState(false);

	React.useEffect(() => {
		if (!open) return;
		setClassId(prefilledClassId ?? "");
		setQuery("");
		setYearFilter("all");
		setBlockSize(50);
		setOffset(0);
		setSelectedIds(new Set());
	}, [open, prefilledClassId]);

	const yearOptions = React.useMemo(() => {
		const values = new Set<string>();
		for (const student of students) {
			values.add(inferYear(student.school_id));
		}
		return Array.from(values).sort();
	}, [students]);

	const filteredStudents = React.useMemo(() => {
		const loweredQuery = query.trim().toLowerCase();
		return students
			.filter((student) => {
				if (
					yearFilter !== "all" &&
					inferYear(student.school_id) !== yearFilter
				) {
					return false;
				}
				if (!loweredQuery) {
					return true;
				}
				return (
					student.full_name.toLowerCase().includes(loweredQuery) ||
					(student.school_id ?? "").toLowerCase().includes(loweredQuery) ||
					student.email.toLowerCase().includes(loweredQuery)
				);
			})
			.sort(sortBySchoolId);
	}, [students, query, yearFilter]);

	const allVisibleSelected =
		filteredStudents.length > 0 &&
		filteredStudents.every((student) => selectedIds.has(student.id));

	const toggleStudent = (studentId: string, checked: boolean) => {
		setSelectedIds((previous) => {
			const next = new Set(previous);
			if (checked) {
				next.add(studentId);
			} else {
				next.delete(studentId);
			}
			return next;
		});
	};

	const toggleSelectVisible = (checked: boolean) => {
		setSelectedIds((previous) => {
			const next = new Set(previous);
			if (checked) {
				for (const student of filteredStudents) {
					next.add(student.id);
				}
			} else {
				for (const student of filteredStudents) {
					next.delete(student.id);
				}
			}
			return next;
		});
	};

	const selectRange = (start: number, count: number) => {
		const boundedStart = Math.max(start, 0);
		const boundedCount = Math.max(count, 1);
		const range = filteredStudents.slice(
			boundedStart,
			boundedStart + boundedCount,
		);
		setSelectedIds(new Set(range.map((student) => student.id)));
	};

	const selectedClass = classes.find((value) => value.id === classId) ?? null;

	const handleSubmit = async () => {
		if (!classId || selectedIds.size === 0) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(classId, Array.from(selectedIds));
			onOpenChange(false);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create enrollments</DialogTitle>
					<DialogDescription>
						Select a class, filter students, and enroll in batch.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="enrollment-class">Class</FieldLabel>
						<Select
							value={classId}
							onValueChange={(value) => setClassId(value ?? "")}
						>
							<SelectTrigger id="enrollment-class" className="w-full">
								<SelectValue placeholder="Select class" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{classes.map((classValue) => (
										<SelectItem key={classValue.id} value={classValue.id}>
											{classValue.course_code} - {classValue.course_name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<div className="flex flex-col gap-3 rounded-lg border p-3">
						<div className="grid gap-3 md:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="enrollment-search">
									Search students
								</FieldLabel>
								<div className="relative">
									<IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50" />
									<Input
										id="enrollment-search"
										value={query}
										onChange={(event) => setQuery(event.currentTarget.value)}
										placeholder="Name, school ID, or email"
										className="pl-8"
									/>
								</div>
							</Field>
							<Field>
								<FieldLabel htmlFor="enrollment-year">Year</FieldLabel>
								<Select
									value={yearFilter}
									onValueChange={(value) => setYearFilter(value ?? "all")}
								>
									<SelectTrigger id="enrollment-year" className="w-full">
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
						</div>
						<div className="grid gap-3 md:grid-cols-4">
							<Field>
								<FieldLabel htmlFor="block-size">Block size</FieldLabel>
								<Input
									id="block-size"
									type="number"
									min={1}
									value={blockSize}
									onChange={(event) => {
										setBlockSize(Number(event.currentTarget.value || 1));
									}}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="block-offset">Offset</FieldLabel>
								<Input
									id="block-offset"
									type="number"
									min={0}
									value={offset}
									onChange={(event) => {
										setOffset(Number(event.currentTarget.value || 0));
									}}
								/>
							</Field>
							<div className="md:col-span-2 flex items-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => selectRange(0, blockSize)}
								>
									Select first {blockSize}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => selectRange(offset, blockSize)}
								>
									Select next {blockSize}
								</Button>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Checkbox
									checked={allVisibleSelected}
									onCheckedChange={(checked) =>
										toggleSelectVisible(Boolean(checked))
									}
									aria-label="Select visible students"
								/>
								<span className="text-sm text-muted-foreground">
									Select visible
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline">
									{filteredStudents.length} visible
								</Badge>
								<Badge variant="outline">{selectedIds.size} selected</Badge>
							</div>
						</div>
						<div className="max-h-[360px] overflow-y-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10" />
										<TableHead>Student</TableHead>
										<TableHead>School ID</TableHead>
										<TableHead>Year</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredStudents.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={4}
												className="h-20 text-center text-muted-foreground"
											>
												No students found.
											</TableCell>
										</TableRow>
									) : (
										filteredStudents.map((student) => (
											<TableRow key={student.id}>
												<TableCell>
													<Checkbox
														checked={selectedIds.has(student.id)}
														onCheckedChange={(checked) =>
															toggleStudent(student.id, Boolean(checked))
														}
														aria-label={`Select ${student.full_name}`}
													/>
												</TableCell>
												<TableCell>{student.full_name}</TableCell>
												<TableCell className="font-mono text-xs">
													{student.school_id ?? "-"}
												</TableCell>
												<TableCell>{inferYear(student.school_id)}</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</FieldGroup>
				<DialogFooter className="items-center justify-between gap-2 sm:justify-between">
					<div className="text-sm text-muted-foreground">
						{selectedClass
							? `${selectedClass.course_code} - ${selectedClass.course_name}`
							: "No class selected"}
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={!classId || selectedIds.size === 0 || submitting}
						>
							Enroll selected
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
