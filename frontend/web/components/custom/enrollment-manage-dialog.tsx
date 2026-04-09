"use client";

import { IconChevronDown, IconFilter, IconSearch } from "@tabler/icons-react";
import * as React from "react";
import type { ClassDto, UserExtendedDto } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
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
	const [classIds, setClassIds] = React.useState<string[]>([]);
	const [query, setQuery] = React.useState("");
	const [yearFilter, setYearFilter] = React.useState<string[]>([]);
	const [blockSize, setBlockSize] = React.useState(50);
	const [offset, setOffset] = React.useState(0);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = React.useState(false);
	const chipsRef = useComboboxAnchor();

	React.useEffect(() => {
		if (!open) return;
		setClassIds(prefilledClassId ? [prefilledClassId] : []);
		setQuery("");
		setYearFilter([]);
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

	const toggleYearFilter = (year: string, checked: boolean) => {
		setYearFilter((prev) => {
			if (checked) return [...new Set([...prev, year])];
			return prev.filter((y) => y !== year);
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
								{(chip) => (
									<ComboboxChip key={chip.value} value={chip.value}>
										{chip.label}
									</ComboboxChip>
								)}
								<ComboboxChipsInput placeholder="Search classes..." />
							</ComboboxChips>
							<ComboboxContent anchor={chipsRef}>
								<ComboboxList>
									<ComboboxEmpty>No classes found.</ComboboxEmpty>
									{classOptions.map((option) => (
										<ComboboxItem
											key={option.value}
											value={option.value}
											label={option.label}
										>
											{option.label}
										</ComboboxItem>
									))}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</Field>
					<div className="flex flex-col gap-3 rounded-lg border p-3">
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
									Year
									<IconChevronDown data-icon="inline-end" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-40">
									<DropdownMenuGroup>
										<DropdownMenuLabel>Year</DropdownMenuLabel>
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
									{yearFilter.length > 0 && (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setYearFilter([])}
											>
												Reset filters
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
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
						<div className="flex flex-wrap items-end gap-2 border-t pt-3">
							<div className="flex items-center gap-2">
								<Label htmlFor="block-size" className="text-sm">
									Block
								</Label>
								<Input
									id="block-size"
									type="number"
									min={1}
									value={blockSize}
									onChange={(event) =>
										setBlockSize(Number(event.currentTarget.value || 1))
									}
									className="w-20"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Label htmlFor="block-offset" className="text-sm">
									Offset
								</Label>
								<Input
									id="block-offset"
									type="number"
									min={0}
									value={offset}
									onChange={(event) =>
										setOffset(Number(event.currentTarget.value || 0))
									}
									className="w-20"
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => selectRange(0, blockSize)}
							>
								Select first {blockSize}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => selectRange(offset, blockSize)}
							>
								Select from offset
							</Button>
						</div>
					</div>
				</FieldGroup>
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
