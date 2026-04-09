"use client";

import {
	IconChevronDown,
	IconFilter,
	IconMinus,
	IconPlus,
	IconSearch,
} from "@tabler/icons-react";
import * as React from "react";
import type { ClassDto, UserExtendedDto } from "@/app/lib/api";

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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { Label } from "@/components/ui/label";
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
	onSubmit: (classIds: string[], studentIds: string[]) => Promise<void>;
};

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
	const [classIds, setClassIds] = React.useState<string[]>([]);
	const [query, setQuery] = React.useState("");
	const [yearFilter, setYearFilter] = React.useState<number[]>([]);
	const [programFilter, setProgramFilter] = React.useState<string[]>([]);
	const [blockSize, setBlockSize] = React.useState(50);
	const [offset, setOffset] = React.useState(0);

	const clampBlock = (v: number) => Math.max(1, Math.min(100, v));
	const clampOffset = (v: number) => Math.max(0, v);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = React.useState(false);
	const chipsRef = useComboboxAnchor();

	React.useEffect(() => {
		if (!open) return;
		setClassIds(prefilledClassId ? [prefilledClassId] : []);
		setQuery("");
		setYearFilter([]);
		setProgramFilter([]);
		setBlockSize(50);
		setOffset(0);
		setSelectedIds(new Set());
	}, [open, prefilledClassId]);

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
				) {
					return false;
				}
				if (
					programFilter.length > 0 &&
					(!student.program || !programFilter.includes(student.program))
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
	}, [students, query, yearFilter, programFilter]);

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

	const toggleYearFilter = (year: number, checked: boolean) => {
		setYearFilter((prev) => {
			if (checked) return [...new Set([...prev, year])];
			return prev.filter((y) => y !== year);
		});
	};

	const toggleProgramFilter = (program: string, checked: boolean) => {
		setProgramFilter((prev) => {
			if (checked) return [...new Set([...prev, program])];
			return prev.filter((p) => p !== program);
		});
	};

	const handleSubmit = async () => {
		if (classIds.length === 0 || selectedIds.size === 0) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(classIds, Array.from(selectedIds));
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
						Select classes, filter students, and enroll in batch.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel>Classes</FieldLabel>
						<Combobox multiple value={classIds} onValueChange={setClassIds}>
							<ComboboxChips ref={chipsRef}>
								{classIds.map((id) => {
									const option = classOptions.find((o) => o.value === id);
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
					</Field>
				</FieldGroup>
				<div className="border-t" />
				<div className="flex flex-col gap-3">
					<Label className="text-sm font-medium">Students</Label>
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50" />
							<Input
								value={query}
								onChange={(event) => setQuery(event.currentTarget.value)}
								placeholder="Search by name, school ID, or email"
								className="pl-8"
							/>
						</div>
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
									<DropdownMenuLabel>Enrollment Year</DropdownMenuLabel>
									{yearOptions.map((year) => (
										<DropdownMenuCheckboxItem
											key={year}
											checked={yearFilter.includes(year)}
											onCheckedChange={(checked) =>
												toggleYearFilter(year, checked)
											}
										>
											{year}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuGroup>
								{programOptions.length > 0 && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuGroup>
											<DropdownMenuLabel>Program</DropdownMenuLabel>
											{programOptions.map((program) => (
												<DropdownMenuCheckboxItem
													key={program}
													checked={programFilter.includes(program)}
													onCheckedChange={(checked) =>
														toggleProgramFilter(program, checked)
													}
												>
													{program}
												</DropdownMenuCheckboxItem>
											))}
										</DropdownMenuGroup>
									</>
								)}
								{(yearFilter.length > 0 || programFilter.length > 0) && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => {
												setYearFilter([]);
												setProgramFilter([]);
											}}
										>
											Reset filters
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="max-h-[360px] overflow-y-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10">
										<Checkbox
											checked={allVisibleSelected}
											onCheckedChange={(checked) =>
												toggleSelectVisible(Boolean(checked))
											}
											aria-label="Select visible students"
										/>
									</TableHead>
									<TableHead>Student</TableHead>
									<TableHead>School ID</TableHead>
									<TableHead>Enrollment Year</TableHead>
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
											<TableCell>{student.enrollment_year ?? "-"}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground whitespace-nowrap">
								Block
							</span>
							<div className="flex items-center">
								<input
									type="number"
									min={1}
									max={100}
									value={blockSize}
									onChange={(e) =>
										setBlockSize(clampBlock(Number(e.currentTarget.value) || 1))
									}
									className="h-8 w-14 rounded-l-md border border-input bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-8 w-8 rounded-none border-l-0"
									onClick={() => setBlockSize((v) => clampBlock(v - 1))}
									disabled={blockSize <= 1}
								>
									<IconMinus className="size-3" />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-8 w-8 rounded-l-none border-l-0"
									onClick={() => setBlockSize((v) => clampBlock(v + 1))}
									disabled={blockSize >= 100}
								>
									<IconPlus className="size-3" />
								</Button>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground whitespace-nowrap">
								Offset
							</span>
							<div className="flex items-center">
								<input
									type="number"
									min={0}
									step={10}
									value={offset}
									onChange={(e) =>
										setOffset(clampOffset(Number(e.currentTarget.value) || 0))
									}
									className="h-8 w-14 rounded-l-md border border-input bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-8 w-8 rounded-none border-l-0"
									onClick={() => setOffset((v) => clampOffset(v - 10))}
									disabled={offset <= 0}
								>
									<IconMinus className="size-3" />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-8 w-8 rounded-l-none border-l-0"
									onClick={() => setOffset((v) => clampOffset(v + 10))}
								>
									<IconPlus className="size-3" />
								</Button>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8"
								onClick={() => selectRange(offset, blockSize)}
							>
								Select range
							</Button>
						</div>
						<div className="ml-auto flex items-center gap-3">
							<span className="text-xs text-muted-foreground">
								{filteredStudents.length} visible
							</span>
							<span className="text-xs text-muted-foreground">
								{selectedIds.size} selected
							</span>
						</div>
					</div>
				</div>
				<DialogFooter className="items-center justify-between gap-2 sm:justify-between">
					<div className="text-sm text-muted-foreground">
						{classIds.length > 0
							? `${classIds.length} class${classIds.length > 1 ? "es" : ""} selected`
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
							disabled={
								classIds.length === 0 || selectedIds.size === 0 || submitting
							}
						>
							Enroll selected
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
