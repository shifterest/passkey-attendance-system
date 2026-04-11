"use client";

import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import * as React from "react";
import {
	type ClassDto,
	type ClassPolicyDto,
	createPolicy,
	deletePolicy,
	type TeacherDto,
	type UserDto,
	updatePolicy,
} from "@/app/lib/api";
import {
	FormSheet,
	FormSheetCancelButton,
} from "@/components/custom/form-sheet";
import { SetPageHeader } from "@/components/custom/page-header-context";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldSeparator,
	FieldTitle,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getSelectLabel } from "@/lib/select-label";

type PolicyScope = "system" | "teacher" | "class";

type PolicyFormValues = {
	standard_assurance_threshold: number;
	high_assurance_threshold: number;
	present_cutoff_minutes: number;
	late_cutoff_minutes: number;
	max_check_ins: number;
};

const DEFAULT_POLICY_VALUES: PolicyFormValues = {
	standard_assurance_threshold: 5,
	high_assurance_threshold: 9,
	present_cutoff_minutes: 5,
	late_cutoff_minutes: 15,
	max_check_ins: 3,
};

const MAX_ASSURANCE_SCORE = 12;
const MAX_WINDOW_MINUTES = 60;

function getScope(policy: ClassPolicyDto): PolicyScope {
	if (policy.class_id) {
		return "class";
	}

	if (policy.created_by) {
		return "teacher";
	}

	return "system";
}

function getScopeLabel(scope: PolicyScope): string {
	if (scope === "system") {
		return "System default";
	}

	if (scope === "teacher") {
		return "Teacher default";
	}

	return "Class override";
}

function toPolicyFormValues(policy: ClassPolicyDto | null): PolicyFormValues {
	if (!policy) {
		return DEFAULT_POLICY_VALUES;
	}

	return {
		standard_assurance_threshold: policy.standard_assurance_threshold,
		high_assurance_threshold: policy.high_assurance_threshold,
		present_cutoff_minutes: policy.present_cutoff_minutes,
		late_cutoff_minutes: policy.late_cutoff_minutes,
		max_check_ins: policy.max_check_ins,
	};
}

function applyPolicyFieldChange(
	values: PolicyFormValues,
	field: keyof PolicyFormValues,
	nextValue: number,
): PolicyFormValues {
	const next = {
		...values,
		[field]: nextValue,
	};

	if (
		field === "standard_assurance_threshold" &&
		next.high_assurance_threshold < next.standard_assurance_threshold
	) {
		next.high_assurance_threshold = next.standard_assurance_threshold;
	}

	if (
		field === "high_assurance_threshold" &&
		next.standard_assurance_threshold > next.high_assurance_threshold
	) {
		next.standard_assurance_threshold = next.high_assurance_threshold;
	}

	if (
		field === "present_cutoff_minutes" &&
		next.late_cutoff_minutes < next.present_cutoff_minutes
	) {
		next.late_cutoff_minutes = next.present_cutoff_minutes;
	}

	if (
		field === "late_cutoff_minutes" &&
		next.present_cutoff_minutes > next.late_cutoff_minutes
	) {
		next.present_cutoff_minutes = next.late_cutoff_minutes;
	}

	if (field === "max_check_ins") {
		next.max_check_ins = Math.max(1, next.max_check_ins);
	}

	return next;
}

function getAssuranceBand(score: number, values: PolicyFormValues) {
	if (score >= values.high_assurance_threshold) {
		return "High";
	}

	if (score >= values.standard_assurance_threshold) {
		return "Standard";
	}

	return "Low";
}

function getAttendanceStatus(
	minutesSinceOpen: number,
	values: PolicyFormValues,
) {
	if (minutesSinceOpen <= values.present_cutoff_minutes) {
		return "Present";
	}

	if (minutesSinceOpen <= values.late_cutoff_minutes) {
		return "Late";
	}

	return "Absent";
}

function getPolicyOwnerLabel(
	policy: ClassPolicyDto,
	teacherMap: Map<string, TeacherDto>,
	currentUser: UserDto,
) {
	if (getScope(policy) === "system") {
		return "Platform default";
	}

	if (!policy.created_by) {
		return "Platform managed";
	}

	if (policy.created_by === currentUser.id) {
		return "Owned by you";
	}

	return teacherMap.get(policy.created_by)?.full_name ?? policy.created_by;
}

function getPolicyTargetLabel(
	policy: ClassPolicyDto,
	classMap: Map<string, ClassDto>,
	teacherMap: Map<string, TeacherDto>,
	currentUser: UserDto,
) {
	const scope = getScope(policy);

	if (scope === "system") {
		return "Used when no teacher default or class override applies.";
	}

	if (scope === "teacher") {
		const owner = getPolicyOwnerLabel(policy, teacherMap, currentUser);
		return `${owner} fallback for uncustomized classes.`;
	}

	if (!policy.class_id) {
		return "Class not found";
	}

	const classValue = classMap.get(policy.class_id);
	if (!classValue) {
		return policy.class_id;
	}

	return `${classValue.course_code} — ${classValue.course_name}`;
}

function canModifyPolicy(policy: ClassPolicyDto, currentUser: UserDto) {
	if (currentUser.role === "admin" || currentUser.role === "operator") {
		return true;
	}

	return policy.created_by === currentUser.id;
}

function sortPolicies(
	policies: ClassPolicyDto[],
	classMap: Map<string, ClassDto>,
	teacherMap: Map<string, TeacherDto>,
	currentUser: UserDto,
) {
	return [...policies].sort((left, right) => {
		const leftLabel = getPolicyTargetLabel(
			left,
			classMap,
			teacherMap,
			currentUser,
		);
		const rightLabel = getPolicyTargetLabel(
			right,
			classMap,
			teacherMap,
			currentUser,
		);

		return leftLabel.localeCompare(rightLabel, undefined, {
			numeric: true,
			sensitivity: "base",
		});
	});
}

function PolicyMetric({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint: string;
}) {
	return (
		<div className="rounded-3xl border bg-muted/40 p-4">
			<div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
				{label}
			</div>
			<div className="mt-2 font-heading text-xl font-medium text-foreground">
				{value}
			</div>
			<div className="mt-1 text-sm text-muted-foreground">{hint}</div>
		</div>
	);
}

function PolicySummaryCard({
	title,
	value,
	description,
	caption,
}: {
	title: string;
	value: string;
	description: string;
	caption: string;
}) {
	return (
		<Card size="sm" className="border border-border/70 shadow-none">
			<CardHeader className="gap-3 border-b">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="font-heading text-3xl font-medium text-foreground">
					{value}
				</div>
				<p className="text-sm text-muted-foreground">{caption}</p>
			</CardContent>
		</Card>
	);
}

function PolicySliderField({
	title,
	description,
	value,
	min,
	max,
	onChange,
	formatValue,
}: {
	title: string;
	description: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
	formatValue: (value: number) => string;
}) {
	return (
		<Field className="gap-4">
			<div className="flex items-start justify-between gap-3">
				<FieldContent>
					<FieldTitle>{title}</FieldTitle>
					<FieldDescription>{description}</FieldDescription>
				</FieldContent>
				<Badge variant="outline" className="shrink-0 font-mono text-xs">
					{formatValue(value)}
				</Badge>
			</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={1}
				onValueChange={(next) => {
					const nextValue = Array.isArray(next) ? next[0] : next;
					onChange(nextValue ?? value);
				}}
			/>
		</Field>
	);
}

function PolicyWindowPreview({ values }: { values: PolicyFormValues }) {
	return (
		<Card size="sm" className="border border-border/70 shadow-none">
			<CardHeader className="gap-1 border-b">
				<CardTitle>Window preview</CardTitle>
				<CardDescription>
					Students are marked present until {values.present_cutoff_minutes}{" "}
					minutes, late until {values.late_cutoff_minutes} minutes, then absent.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 md:grid-cols-3">
				<PolicyMetric
					label="Present"
					value={`0–${values.present_cutoff_minutes} min`}
					hint="Automatically marked present."
				/>
				<PolicyMetric
					label="Late"
					value={`${values.present_cutoff_minutes + 1}–${values.late_cutoff_minutes} min`}
					hint="Attendance remains valid but late."
				/>
				<PolicyMetric
					label="After close"
					value={`>${values.late_cutoff_minutes} min`}
					hint="Status is absent and no longer shifts."
				/>
			</CardContent>
		</Card>
	);
}

function PolicyFormFields({
	values,
	onChange,
}: {
	values: PolicyFormValues;
	onChange: (field: keyof PolicyFormValues, value: number) => void;
}) {
	return (
		<FieldGroup>
			<div className="grid gap-6 xl:grid-cols-2">
				<PolicySliderField
					title="Standard threshold"
					description="Scores below this band stay low assurance and need explicit teacher confirmation."
					value={values.standard_assurance_threshold}
					min={0}
					max={MAX_ASSURANCE_SCORE}
					onChange={(value) => onChange("standard_assurance_threshold", value)}
					formatValue={(value) => `≥${value}`}
				/>
				<PolicySliderField
					title="High threshold"
					description="Scores at or above this band are auto-confirmed without follow-up."
					value={values.high_assurance_threshold}
					min={0}
					max={MAX_ASSURANCE_SCORE}
					onChange={(value) => onChange("high_assurance_threshold", value)}
					formatValue={(value) => `≥${value}`}
				/>
			</div>
			<FieldSeparator>Attendance window</FieldSeparator>
			<div className="grid gap-6 xl:grid-cols-2">
				<PolicySliderField
					title="Present cutoff"
					description="Minutes from session open that still count as present."
					value={values.present_cutoff_minutes}
					min={0}
					max={MAX_WINDOW_MINUTES}
					onChange={(value) => onChange("present_cutoff_minutes", value)}
					formatValue={(value) => `${value} min`}
				/>
				<PolicySliderField
					title="Late cutoff"
					description="Minutes from session open that still count as late instead of absent."
					value={values.late_cutoff_minutes}
					min={0}
					max={MAX_WINDOW_MINUTES}
					onChange={(value) => onChange("late_cutoff_minutes", value)}
					formatValue={(value) => `${value} min`}
				/>
			</div>
			<FieldSeparator>Retry budget</FieldSeparator>
			<PolicySliderField
				title="Max check-ins per window"
				description="Limits how many retries a student gets before the current attendance window is exhausted."
				value={values.max_check_ins}
				min={1}
				max={5}
				onChange={(value) => onChange("max_check_ins", value)}
				formatValue={(value) => `${value}`}
			/>
			<PolicyWindowPreview values={values} />
		</FieldGroup>
	);
}

function PolicyPlayground({ values }: { values: PolicyFormValues }) {
	const [score, setScore] = React.useState(
		Math.min(values.standard_assurance_threshold, MAX_ASSURANCE_SCORE),
	);
	const [minutes, setMinutes] = React.useState(values.present_cutoff_minutes);

	React.useEffect(() => {
		setScore(
			Math.min(values.standard_assurance_threshold, MAX_ASSURANCE_SCORE),
		);
		setMinutes(values.present_cutoff_minutes);
	}, [values]);

	const band = getAssuranceBand(score, values);
	const attendanceStatus = getAttendanceStatus(minutes, values);
	const reviewState =
		band === "Low"
			? "Teacher confirmation required"
			: band === "High"
				? "Auto-confirmed"
				: "Auto-accepted";

	return (
		<Accordion>
			<AccordionItem value="playground">
				<AccordionTrigger>
					<div>
						<div className="font-medium text-foreground">Policy playground</div>
						<div className="mt-1 text-sm font-normal text-muted-foreground">
							Preview how band thresholds and time windows behave before saving.
						</div>
					</div>
				</AccordionTrigger>
				<AccordionContent>
					<div className="space-y-6">
						<div className="grid gap-6 xl:grid-cols-2">
							<PolicySliderField
								title="Assurance score"
								description="Try the effective score a check-in would receive after proximity and integrity weighting."
								value={score}
								min={0}
								max={MAX_ASSURANCE_SCORE}
								onChange={setScore}
								formatValue={(value) => `${value}`}
							/>
							<PolicySliderField
								title="Minutes since open"
								description="Slide forward through the attendance window to see when present becomes late and absent."
								value={minutes}
								min={0}
								max={MAX_WINDOW_MINUTES}
								onChange={setMinutes}
								formatValue={(value) => `${value} min`}
							/>
						</div>
						<div className="grid gap-3 lg:grid-cols-3">
							<PolicyMetric
								label="Band"
								value={band}
								hint={`Standard begins at ${values.standard_assurance_threshold}; high begins at ${values.high_assurance_threshold}.`}
							/>
							<PolicyMetric
								label="Attendance"
								value={attendanceStatus}
								hint={`Present until ${values.present_cutoff_minutes} min, late until ${values.late_cutoff_minutes} min.`}
							/>
							<PolicyMetric
								label="Teacher action"
								value={reviewState}
								hint="Low band attempts stay held; standard and high proceed automatically."
							/>
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function CreatePolicySheet({
	currentUser,
	policies,
	classes,
	onCreated,
	trigger,
}: {
	currentUser: UserDto;
	policies: ClassPolicyDto[];
	classes: ClassDto[];
	onCreated: () => Promise<void>;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = React.useState(false);
	const [scope, setScope] = React.useState<PolicyScope>(
		currentUser.role === "teacher" ? "teacher" : "system",
	);
	const [classId, setClassId] = React.useState("");
	const [values, setValues] = React.useState<PolicyFormValues>(
		DEFAULT_POLICY_VALUES,
	);
	const [submitting, setSubmitting] = React.useState(false);

	const teacherDefaultExists = React.useMemo(
		() =>
			policies.some(
				(policy) =>
					getScope(policy) === "teacher" &&
					policy.created_by === currentUser.id,
			),
		[currentUser.id, policies],
	);
	const existingClassOverrideIds = React.useMemo(
		() =>
			new Set(
				policies
					.filter(
						(policy) =>
							getScope(policy) === "class" &&
							policy.created_by === currentUser.id,
					)
					.map((policy) => policy.class_id)
					.filter((value): value is string => Boolean(value)),
			),
		[currentUser.id, policies],
	);
	const availableClassOptions = React.useMemo(
		() =>
			classes
				.filter((classValue) => !existingClassOverrideIds.has(classValue.id))
				.map((classValue) => ({
					value: classValue.id,
					label: `${classValue.course_code} — ${classValue.course_name}`,
				})),
		[classes, existingClassOverrideIds],
	);
	const scopeOptions = React.useMemo(() => {
		if (currentUser.role === "teacher") {
			return [
				!teacherDefaultExists
					? { value: "teacher", label: "Teacher default" }
					: null,
				availableClassOptions.length > 0
					? { value: "class", label: "Class override" }
					: null,
			].filter(
				(option): option is { value: PolicyScope; label: string } =>
					option !== null,
			);
		}

		return [{ value: "system" as PolicyScope, label: "System default" }];
	}, [availableClassOptions.length, currentUser.role, teacherDefaultExists]);

	React.useEffect(() => {
		if (!open) {
			return;
		}

		setValues(DEFAULT_POLICY_VALUES);
		setScope(
			scopeOptions[0]?.value ??
				(currentUser.role === "teacher" ? "teacher" : "system"),
		);
		setClassId(availableClassOptions[0]?.value ?? "");
	}, [availableClassOptions, currentUser.role, open, scopeOptions]);

	const disableSubmit = scope === "class" && !classId;

	async function handleSubmit() {
		if (disableSubmit || submitting) {
			return;
		}

		setSubmitting(true);
		try {
			await createPolicy({
				class_id: scope === "class" ? classId : null,
				...values,
			});
			setOpen(false);
			await onCreated();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={setOpen}
			trigger={trigger}
			title="Create policy"
			description="Create one default or override at a time so the effective fallback chain stays explicit."
			contentClassName="sm:max-w-2xl"
			footer={
				<>
					<FormSheetCancelButton />
					<Button onClick={handleSubmit} disabled={submitting || disableSubmit}>
						{submitting ? "Creating..." : "Create"}
					</Button>
				</>
			}
		>
			<FieldGroup>
				<Field className="gap-3">
					<FieldContent>
						<FieldTitle>Scope</FieldTitle>
						<FieldDescription>
							System defaults set the global fallback. Teacher defaults and
							class overrides stay owned by the teacher account that created
							them.
						</FieldDescription>
					</FieldContent>
					<Select
						value={scope}
						onValueChange={(value) => setScope(value as PolicyScope)}
					>
						<SelectTrigger className="w-full sm:max-w-sm">
							<SelectValue>{getSelectLabel(scope, scopeOptions)}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{scopeOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				{scope === "class" ? (
					<Field className="gap-3">
						<FieldContent>
							<FieldTitle>Class target</FieldTitle>
							<FieldDescription>
								Pick the class that should diverge from the default timing or
								assurance thresholds.
							</FieldDescription>
						</FieldContent>
						<Select
							value={classId}
							onValueChange={(value) => {
								if (value !== null) {
									setClassId(value);
								}
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a class">
									{getSelectLabel(classId, availableClassOptions)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{availableClassOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				) : null}
				<FieldSeparator>Thresholds and timing</FieldSeparator>
				<PolicyFormFields
					values={values}
					onChange={(field, value) =>
						setValues((current) =>
							applyPolicyFieldChange(current, field, value),
						)
					}
				/>
			</FieldGroup>
		</FormSheet>
	);
}

function EditPolicySheet({
	policy,
	targetLabel,
	trigger,
	onUpdated,
}: {
	policy: ClassPolicyDto;
	targetLabel: string;
	trigger: React.ReactNode;
	onUpdated: () => Promise<void>;
}) {
	const [open, setOpen] = React.useState(false);
	const [values, setValues] = React.useState<PolicyFormValues>(() =>
		toPolicyFormValues(policy),
	);
	const [submitting, setSubmitting] = React.useState(false);

	React.useEffect(() => {
		setValues(toPolicyFormValues(policy));
	}, [policy]);

	async function handleSubmit() {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		try {
			await updatePolicy(policy.id, values);
			setOpen(false);
			await onUpdated();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={setOpen}
			trigger={trigger}
			title="Edit policy"
			description={targetLabel}
			contentClassName="sm:max-w-2xl"
			footer={
				<>
					<FormSheetCancelButton />
					<Button onClick={handleSubmit} disabled={submitting}>
						{submitting ? "Saving..." : "Save"}
					</Button>
				</>
			}
		>
			<PolicyFormFields
				values={values}
				onChange={(field, value) =>
					setValues((current) => applyPolicyFieldChange(current, field, value))
				}
			/>
		</FormSheet>
	);
}

function DeletePolicyDialog({
	policy,
	scopeLabel,
	trigger,
	onDeleted,
}: {
	policy: ClassPolicyDto;
	scopeLabel: string;
	trigger: React.ReactNode;
	onDeleted: () => Promise<void>;
}) {
	const [open, setOpen] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);

	async function handleDelete() {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		try {
			await deletePolicy(policy.id);
			setOpen(false);
			await onDeleted();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={React.isValidElement(trigger) ? trigger : undefined}
			>
				{!React.isValidElement(trigger) ? trigger : null}
			</DialogTrigger>
			<DialogContent>
				<div className="space-y-1">
					<DialogTitle>Delete policy</DialogTitle>
					<DialogDescription>
						This permanently removes the {scopeLabel.toLowerCase()} and pushes
						affected classes back to the next available fallback.
					</DialogDescription>
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={submitting}
					>
						{submitting ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PolicyCard({
	policy,
	classMap,
	teacherMap,
	currentUser,
	onRefresh,
}: {
	policy: ClassPolicyDto;
	classMap: Map<string, ClassDto>;
	teacherMap: Map<string, TeacherDto>;
	currentUser: UserDto;
	onRefresh: () => Promise<void>;
}) {
	const scope = getScope(policy);
	const scopeLabel = getScopeLabel(scope);
	const targetLabel = getPolicyTargetLabel(
		policy,
		classMap,
		teacherMap,
		currentUser,
	);
	const ownerLabel = getPolicyOwnerLabel(policy, teacherMap, currentUser);
	const isEditable = canModifyPolicy(policy, currentUser);
	const heading =
		scope === "system"
			? "Global fallback"
			: scope === "teacher"
				? ownerLabel
				: targetLabel;
	const description =
		scope === "system"
			? "Applies whenever neither a teacher default nor a class override is present."
			: scope === "teacher"
				? `${ownerLabel} baseline for classes that do not have a direct override.`
				: "Direct class override used in place of the default fallback chain.";

	return (
		<Card size="sm" className="border border-border/70 shadow-none">
			<CardHeader className="gap-4 border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-2">
						<Badge variant="outline">{scopeLabel}</Badge>
						<CardTitle>{heading}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
					{isEditable ? (
						<div className="flex flex-wrap items-center gap-2">
							<EditPolicySheet
								policy={policy}
								targetLabel={targetLabel}
								trigger={
									<Button variant="outline" size="sm">
										<IconPencil data-icon="inline-start" />
										Edit
									</Button>
								}
								onUpdated={onRefresh}
							/>
							<DeletePolicyDialog
								policy={policy}
								scopeLabel={scopeLabel}
								trigger={
									<Button variant="destructive" size="sm">
										<IconTrash data-icon="inline-start" />
										Delete
									</Button>
								}
								onDeleted={onRefresh}
							/>
						</div>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
				<PolicyMetric
					label="Standard"
					value={`≥${policy.standard_assurance_threshold}`}
					hint="Automatic acceptance begins here."
				/>
				<PolicyMetric
					label="High"
					value={`≥${policy.high_assurance_threshold}`}
					hint="Automatic confirmation begins here."
				/>
				<PolicyMetric
					label="Present"
					value={`${policy.present_cutoff_minutes} min`}
					hint="Present attendance limit from session open."
				/>
				<PolicyMetric
					label="Late"
					value={`${policy.late_cutoff_minutes} min`}
					hint="Late attendance limit from session open."
				/>
				<PolicyMetric
					label="Retries"
					value={`${policy.max_check_ins}`}
					hint="Check-in attempts allowed inside one window."
				/>
			</CardContent>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 text-sm text-muted-foreground">
				<span>{targetLabel}</span>
				<span>{ownerLabel}</span>
			</div>
		</Card>
	);
}

function PolicyEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card
			size="sm"
			className="border border-dashed border-border/80 shadow-none"
		>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
		</Card>
	);
}

export function DataTablePolicies({
	policies,
	classes,
	teachers,
	currentUser,
	onRefresh,
}: {
	policies: ClassPolicyDto[];
	classes: ClassDto[];
	teachers: TeacherDto[];
	currentUser: UserDto;
	onRefresh: () => Promise<void>;
}) {
	const classMap = React.useMemo(
		() => new Map(classes.map((classValue) => [classValue.id, classValue])),
		[classes],
	);
	const teacherMap = React.useMemo(
		() => new Map(teachers.map((teacher) => [teacher.id, teacher])),
		[teachers],
	);
	const systemPolicies = React.useMemo(
		() => policies.filter((policy) => getScope(policy) === "system"),
		[policies],
	);
	const teacherPolicies = React.useMemo(
		() =>
			sortPolicies(
				policies.filter((policy) => getScope(policy) === "teacher"),
				classMap,
				teacherMap,
				currentUser,
			),
		[classMap, currentUser, policies, teacherMap],
	);
	const classPolicies = React.useMemo(
		() =>
			sortPolicies(
				policies.filter((policy) => getScope(policy) === "class"),
				classMap,
				teacherMap,
				currentUser,
			),
		[classMap, currentUser, policies, teacherMap],
	);
	const teacherDefaultForCurrentUser = React.useMemo(
		() =>
			teacherPolicies.find((policy) => policy.created_by === currentUser.id) ??
			null,
		[currentUser.id, teacherPolicies],
	);
	const playgroundValues = React.useMemo(
		() =>
			toPolicyFormValues(
				teacherDefaultForCurrentUser ??
					systemPolicies[0] ??
					classPolicies[0] ??
					null,
			),
		[classPolicies, systemPolicies, teacherDefaultForCurrentUser],
	);
	const canCreatePolicy = React.useMemo(() => {
		if (currentUser.role === "teacher") {
			const teacherDefaultExists = teacherPolicies.some(
				(policy) => policy.created_by === currentUser.id,
			);
			const classOverrideCount = classPolicies.filter(
				(policy) => policy.created_by === currentUser.id,
			).length;

			return !teacherDefaultExists || classOverrideCount < classes.length;
		}

		return systemPolicies.length === 0;
	}, [
		classPolicies,
		classes.length,
		currentUser.id,
		currentUser.role,
		systemPolicies.length,
		teacherPolicies,
	]);
	const createLabel =
		currentUser.role === "teacher"
			? teacherDefaultForCurrentUser
				? "Create override"
				: "Create policy"
			: "Create default";

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Policies"
				description="Assurance thresholds and session window configuration."
				actions={
					canCreatePolicy ? (
						<CreatePolicySheet
							currentUser={currentUser}
							policies={policies}
							classes={classes}
							onCreated={onRefresh}
							trigger={
								<Button size="sm">
									<IconPlus data-icon="inline-start" />
									{createLabel}
								</Button>
							}
						/>
					) : null
				}
			/>
			<div className="grid gap-4 xl:grid-cols-3">
				<PolicySummaryCard
					title="System default"
					value={
						systemPolicies.length > 0
							? String(systemPolicies.length)
							: "Missing"
					}
					description="The global fallback used when no teacher or class-specific rule exists."
					caption={
						systemPolicies.length > 0
							? `${systemPolicies[0].standard_assurance_threshold}/${systemPolicies[0].high_assurance_threshold} threshold baseline is currently active.`
							: "Create one baseline so every class inherits a predictable fallback."
					}
				/>
				<PolicySummaryCard
					title={
						currentUser.role === "teacher" ? "Your default" : "Teacher defaults"
					}
					value={
						currentUser.role === "teacher"
							? teacherDefaultForCurrentUser
								? "Ready"
								: "Missing"
							: String(teacherPolicies.length)
					}
					description="Teacher-owned baselines sit between the system default and direct class overrides."
					caption={
						currentUser.role === "teacher"
							? teacherDefaultForCurrentUser
								? `Classes without an override fall back to ${teacherDefaultForCurrentUser.standard_assurance_threshold}/${teacherDefaultForCurrentUser.high_assurance_threshold}.`
								: "Create your teacher default once, then override only the classes that really need it."
							: `${teacherPolicies.length} teacher-managed fallback policies are visible in this workspace.`
					}
				/>
				<PolicySummaryCard
					title="Class overrides"
					value={String(classPolicies.length)}
					description="Direct overrides replace the default chain for one specific class."
					caption={
						currentUser.role === "teacher"
							? `${classPolicies.filter((policy) => policy.created_by === currentUser.id).length} of your classes currently diverge from the default fallback.`
							: `${classPolicies.length} classes across the workspace have an explicit override.`
					}
				/>
			</div>
			<PolicyPlayground values={playgroundValues} />
			<div className="space-y-4">
				<div>
					<h2 className="font-heading text-lg font-medium text-foreground">
						System default
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Keep one clear baseline so classes always fall back to a known
						policy.
					</p>
				</div>
				<div className="grid gap-4">
					{systemPolicies.length > 0 ? (
						systemPolicies.map((policy) => (
							<PolicyCard
								key={policy.id}
								policy={policy}
								classMap={classMap}
								teacherMap={teacherMap}
								currentUser={currentUser}
								onRefresh={onRefresh}
							/>
						))
					) : (
						<PolicyEmptyState
							title="No system default yet"
							description="Create the platform-wide fallback before layering teacher-specific defaults or class overrides."
						/>
					)}
				</div>
			</div>
			<div className="space-y-4">
				<div>
					<h2 className="font-heading text-lg font-medium text-foreground">
						{currentUser.role === "teacher"
							? "Teacher default"
							: "Teacher defaults"}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Teacher-owned baselines keep routine class policy consistent without
						forcing every class to carry an override.
					</p>
				</div>
				<div className="grid gap-4 xl:grid-cols-2">
					{teacherPolicies.length > 0 ? (
						teacherPolicies.map((policy) => (
							<PolicyCard
								key={policy.id}
								policy={policy}
								classMap={classMap}
								teacherMap={teacherMap}
								currentUser={currentUser}
								onRefresh={onRefresh}
							/>
						))
					) : (
						<PolicyEmptyState
							title="No teacher defaults yet"
							description="Teacher defaults are optional, but they keep repeated class policy changes from turning into manual override sprawl."
						/>
					)}
				</div>
			</div>
			<div className="space-y-4">
				<div>
					<h2 className="font-heading text-lg font-medium text-foreground">
						Class overrides
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Use direct overrides only when one class truly needs a different
						timing or assurance policy than its default fallback.
					</p>
				</div>
				<div className="grid gap-4 xl:grid-cols-2">
					{classPolicies.length > 0 ? (
						classPolicies.map((policy) => (
							<PolicyCard
								key={policy.id}
								policy={policy}
								classMap={classMap}
								teacherMap={teacherMap}
								currentUser={currentUser}
								onRefresh={onRefresh}
							/>
						))
					) : (
						<PolicyEmptyState
							title="No class overrides yet"
							description="That is usually a healthy sign. Keep overrides rare and let the fallback chain do most of the work."
						/>
					)}
				</div>
			</div>
		</div>
	);
}
