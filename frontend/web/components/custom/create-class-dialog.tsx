"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createClass, type SemesterDto, type TeacherDto } from "@/app/lib/api";
import {
	FormSheet,
	FormSheetCancelButton,
} from "@/components/custom/form-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Field,
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
import { getSelectLabel } from "@/lib/select-label";

const DAYS = [
	{ key: "Sun", label: "S" },
	{ key: "Mon", label: "M" },
	{ key: "Tue", label: "T" },
	{ key: "Wed", label: "W" },
	{ key: "Thu", label: "T" },
	{ key: "Fri", label: "F" },
	{ key: "Sat", label: "S" },
];

interface ScheduleBlock {
	id: string;
	days: string[];
	start_time: string;
	end_time: string;
}

function createScheduleBlock(): ScheduleBlock {
	return {
		id: crypto.randomUUID(),
		days: [],
		start_time: "08:00",
		end_time: "09:00",
	};
}

interface CreateClassDialogProps {
	teachers: TeacherDto[];
	semesters: SemesterDto[];
	trigger: React.ReactNode;
}

export function CreateClassDialog({
	teachers,
	semesters,
	trigger,
}: CreateClassDialogProps) {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);
	const [teacherId, setTeacherId] = React.useState("");
	const [semesterId, setSemesterId] = React.useState("");
	const [courseCode, setCourseCode] = React.useState("");
	const [courseName, setCourseName] = React.useState("");
	const [schedule, setSchedule] = React.useState<ScheduleBlock[]>([
		createScheduleBlock(),
	]);
	const addBlockRef = React.useRef<HTMLButtonElement>(null);
	const teacherOptions = React.useMemo(
		() =>
			teachers.map((teacher) => ({
				value: teacher.id,
				label: teacher.full_name,
			})),
		[teachers],
	);
	const semesterOptions = React.useMemo(
		() =>
			semesters.map((semester) => ({
				value: semester.id,
				label: semester.name,
			})),
		[semesters],
	);

	function reset() {
		setTeacherId("");
		setSemesterId("");
		setCourseCode("");
		setCourseName("");
		setSchedule([createScheduleBlock()]);
	}

	function updateBlock(index: number, patch: Partial<ScheduleBlock>) {
		setSchedule((prev) =>
			prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
		);
	}

	function toggleDay(index: number, day: string) {
		setSchedule((prev) =>
			prev.map((b, i) => {
				if (i !== index) return b;
				const days = b.days.includes(day)
					? b.days.filter((d) => d !== day)
					: [...b.days, day];
				return { ...b, days };
			}),
		);
	}

	async function handleSubmit() {
		if (
			!courseCode.trim() ||
			!courseName.trim() ||
			!teacherId ||
			!semesterId ||
			submitting
		)
			return;
		const validSchedule = schedule.filter(
			(b) => b.days.length > 0 && b.start_time && b.end_time,
		);
		setSubmitting(true);
		try {
			await createClass({
				teacher_id: teacherId,
				semester_id: semesterId,
				course_code: courseCode.trim(),
				course_name: courseName.trim(),
				schedule: validSchedule.map(({ days, start_time, end_time }) => ({
					days,
					start_time,
					end_time,
				})),
			});
			reset();
			setOpen(false);
			router.refresh();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
			trigger={trigger}
			title="Create class"
			description="Add a new course with schedule and teacher assignment."
			contentClassName="sm:max-w-2xl"
			footer={
				<>
					<FormSheetCancelButton />
					<LoadingButton
						onClick={handleSubmit}
						loading={submitting}
						loadingText="Creating…"
						disabled={
							!courseCode.trim() ||
							!courseName.trim() ||
							!teacherId ||
							!semesterId
						}
					>
						Create
					</LoadingButton>
				</>
			}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="create-class-semester">Semester</FieldLabel>
					<Select
						value={semesterId}
						onValueChange={(v) => {
							if (v !== null) setSemesterId(v);
						}}
					>
						<SelectTrigger id="create-class-semester" className="w-full">
							<SelectValue placeholder="Select a semester">
								{getSelectLabel(semesterId, semesterOptions)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{semesterOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor="create-class-teacher">Teacher</FieldLabel>
					<Select
						value={teacherId}
						onValueChange={(v) => {
							if (v !== null) setTeacherId(v);
						}}
					>
						<SelectTrigger id="create-class-teacher" className="w-full">
							<SelectValue placeholder="Select a teacher">
								{getSelectLabel(teacherId, teacherOptions)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{teacherOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<FieldSeparator />
				<Field>
					<FieldLabel htmlFor="create-class-code">Course code</FieldLabel>
					<Input
						id="create-class-code"
						value={courseCode}
						onChange={(e) => setCourseCode(e.target.value)}
						placeholder="CS 108"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="create-class-name">Course name</FieldLabel>
					<Input
						id="create-class-name"
						value={courseName}
						onChange={(e) => setCourseName(e.target.value)}
						placeholder="Introduction to Computing"
					/>
				</Field>
				<FieldSeparator />
				<div className="flex flex-col gap-3">
					<FieldLabel>Schedule</FieldLabel>
					{schedule.map((block, i) => (
						<Card key={block.id} size="sm">
							<CardHeader className="flex-row items-center justify-between">
								<CardTitle>Block {i + 1}</CardTitle>
								{schedule.length > 1 && (
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={() =>
											setSchedule((p) => p.filter((_, j) => j !== i))
										}
									>
										<IconTrash />
									</Button>
								)}
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								<div className="grid grid-cols-7 gap-1">
									{DAYS.map((day) => (
										<Button
											key={day.key}
											variant={
												block.days.includes(day.key) ? "default" : "outline"
											}
											size="sm"
											className="h-8 text-xs"
											onClick={() => toggleDay(i, day.key)}
										>
											{day.label}
										</Button>
									))}
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Field>
										<FieldLabel className="text-xs">Start</FieldLabel>
										<Input
											type="time"
											value={block.start_time}
											onChange={(e) =>
												updateBlock(i, { start_time: e.target.value })
											}
										/>
									</Field>
									<Field>
										<FieldLabel className="text-xs">End</FieldLabel>
										<Input
											type="time"
											value={block.end_time}
											onChange={(e) =>
												updateBlock(i, { end_time: e.target.value })
											}
										/>
									</Field>
								</div>
							</CardContent>
						</Card>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setSchedule((p) => [...p, createScheduleBlock()]);
							requestAnimationFrame(() => {
								addBlockRef.current?.scrollIntoView({
									behavior: "smooth",
									block: "end",
								});
							});
						}}
						ref={addBlockRef}
					>
						<IconPlus data-icon="inline-start" />
						Add schedule block
					</Button>
				</div>
			</FieldGroup>
		</FormSheet>
	);
}
