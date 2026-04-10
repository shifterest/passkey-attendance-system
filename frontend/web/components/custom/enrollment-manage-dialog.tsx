"use client";

import { IconMinus, IconPlus, IconSearch } from "@tabler/icons-react";
import * as React from "react";
import type { ClassDto, UserExtendedDto } from "@/app/lib/api";

import { DataTableFilterMenu } from "@/components/custom/data-table-shared";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
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
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = React.useState(false);
	const chipsRef = useComboboxAnchor();

	const clampBlock = (value: number) => Math.max(1, Math.min(100, value));
	const clampOffset = (value: number) => Math.max(0, value);

	React.useEffect(() => {
		if (!open) {
			return;
		}

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
			classes.map((classValue) => ({
				value: classValue.id,
				label: `${classValue.course_code} - ${classValue.course_name}`,
			})),
		[classes],
	);

	const yearOptions = React.useMemo(() => {
		const values = new Set<number>();
		for (const student of students) {
			if (student.enrollment_year != null) {
				values.add(student.enrollment_year);
			}
		}

		return Array.from(values).sort((a, b) => a - b);
	}, [students]);

	const programOptions = React.useMemo(() => {
		const values = new Set<string>();
		for (const student of students) {
			if (student.program) {
				values.add(student.program);
			}
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
	const someVisibleSelected = filteredStudents.some((student) =>
		selectedIds.has(student.id),
	);

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
		setYearFilter((previous) => {
			if (checked) {
				return [...new Set([...previous, year])];
			}
			return previous.filter((value) => value !== year);
		});
	};

	const toggleProgramFilter = (program: string, checked: boolean) => {
		setProgramFilter((previous) => {
			if (checked) {
				return [...new Set([...previous, program])];
			}
			return previous.filter((value) => value !== program);
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

	const selectionSummary = `${filteredStudents.length} visible · ${selectedIds.size} selected`;
	const classSummary =
		classIds.length === 0
			? "No classes selected"
			: `${classIds.length} class${classIds.length > 1 ? "es" : ""} selected`;

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
										const option = classOptions.find(
											(item) => item.value === id,
										);
										return (
											<ComboboxChip key={id}>
												{option?.label ?? id}
											</ComboboxChip>
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
					<FieldSeparator />
					<div className="flex flex-col gap-3">
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
							<DataTableFilterMenu>
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
							</DataTableFilterMenu>
						</div>
						<div className="max-h-[360px] overflow-y-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">
											<div className="flex items-center justify-center">
												<Checkbox
													checked={allVisibleSelected}
													indeterminate={
														someVisibleSelected && !allVisibleSelected
													}
													onCheckedChange={(checked) =>
														toggleSelectVisible(!!checked)
													}
													aria-label="Select visible students"
												/>
											</div>
										</TableHead>
										<TableHead>Student</TableHead>
										<TableHead>School ID</TableHead>
										<TableHead>Program</TableHead>
										<TableHead>Enrollment Year</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredStudents.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={5}
												className="py-6 text-center text-sm text-muted-foreground"
											>
												No students match the current filters.
											</TableCell>
										</TableRow>
									) : (
										filteredStudents.map((student) => (
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
													<div className="flex flex-col">
														<span className="font-medium">
															{student.full_name}
														</span>
														<span className="text-xs text-muted-foreground">
															{student.email}
														</span>
													</div>
												</TableCell>
												<TableCell className="font-mono text-xs">
													{student.school_id ?? "-"}
												</TableCell>
												<TableCell>{student.program ?? "—"}</TableCell>
												<TableCell>{student.enrollment_year ?? "—"}</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						<FieldSeparator />
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel htmlFor="enrollment-block-size">
									Block size
								</FieldLabel>
								<FieldDescription>
									Choose how many visible students a range selection should
									capture.
								</FieldDescription>
							</FieldContent>
							<ButtonGroup>
								<Input
									id="enrollment-block-size"
									type="number"
									min={1}
									max={100}
									value={blockSize}
									onChange={(event) =>
										setBlockSize(
											clampBlock(Number(event.currentTarget.value) || 1),
										)
									}
									className="h-8 w-16 text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									onClick={() => setBlockSize((value) => clampBlock(value - 1))}
									disabled={blockSize <= 1}
								>
									<IconMinus />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									onClick={() => setBlockSize((value) => clampBlock(value + 1))}
									disabled={blockSize >= 100}
								>
									<IconPlus />
								</Button>
							</ButtonGroup>
						</Field>
						<FieldSeparator />
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel htmlFor="enrollment-offset">Offset</FieldLabel>
								<FieldDescription>
									Shift the visible range before applying the batch selection.
								</FieldDescription>
							</FieldContent>
							<ButtonGroup>
								<Input
									id="enrollment-offset"
									type="number"
									min={0}
									step={10}
									value={offset}
									onChange={(event) =>
										setOffset(
											clampOffset(Number(event.currentTarget.value) || 0),
										)
									}
									className="h-8 w-16 text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									onClick={() => setOffset((value) => clampOffset(value - 10))}
									disabled={offset <= 0}
								>
									<IconMinus />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									onClick={() => setOffset((value) => clampOffset(value + 10))}
								>
									<IconPlus />
								</Button>
							</ButtonGroup>
						</Field>
						<div className="flex justify-end">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => selectRange(offset, blockSize)}
							>
								Select range
							</Button>
						</div>
					</div>
				</FieldGroup>
				<DialogFooter className="items-center justify-between gap-2 sm:justify-between">
					<div className="text-sm text-muted-foreground">
						{selectionSummary}
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
							{submitting ? "Creating..." : "Create enrollments"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
