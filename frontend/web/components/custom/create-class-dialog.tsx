"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createClass, type SemesterDto, type TeacherDto } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
	days: string[];
	start_time: string;
	end_time: string;
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
		{ days: [], start_time: "08:00", end_time: "09:00" },
	]);

	function reset() {
		setTeacherId("");
		setSemesterId("");
		setCourseCode("");
		setCourseName("");
		setSchedule([{ days: [], start_time: "08:00", end_time: "09:00" }]);
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
				schedule: validSchedule,
			});
			reset();
			setOpen(false);
			router.refresh();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger
				render={React.isValidElement(trigger) ? trigger : undefined}
			>
				{!React.isValidElement(trigger) && trigger}
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create class</DialogTitle>
					<DialogDescription>
						Add a new course with schedule and teacher assignment.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="create-class-teacher">Teacher</FieldLabel>
						<Select
							value={teacherId}
							onValueChange={(v) => {
								if (v !== null) setTeacherId(v);
							}}
						>
							<SelectTrigger id="create-class-teacher" className="w-full">
								<SelectValue placeholder="Select a teacher" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{teachers.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.full_name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="create-class-semester">Semester</FieldLabel>
						<Select
							value={semesterId}
							onValueChange={(v) => {
								if (v !== null) setSemesterId(v);
							}}
						>
							<SelectTrigger id="create-class-semester" className="w-full">
								<SelectValue placeholder="Select a semester" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{semesters.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											{s.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
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
					<div className="flex flex-col gap-3">
						<FieldLabel>Schedule</FieldLabel>
						{schedule.map((block, i) => (
							<div
								key={`schedule-block-${i}`}
								className="flex flex-col gap-2 rounded-lg border p-3"
							>
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-muted-foreground">
										Block {i + 1}
									</span>
									{schedule.length > 1 && (
										<Button
											variant="ghost"
											size="icon"
											className="size-6"
											onClick={() =>
												setSchedule((p) => p.filter((_, j) => j !== i))
											}
										>
											<IconTrash className="size-3.5" />
										</Button>
									)}
								</div>
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
								<div className="border-t" />
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
							</div>
						))}
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setSchedule((p) => [
									...p,
									{ days: [], start_time: "08:00", end_time: "09:00" },
								])
							}
						>
							<IconPlus data-icon="inline-start" />
							Add schedule block
						</Button>
					</div>
				</FieldGroup>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						onClick={handleSubmit}
						disabled={
							submitting ||
							!courseCode.trim() ||
							!courseName.trim() ||
							!teacherId ||
							!semesterId
						}
					>
						{submitting ? "Creating…" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
