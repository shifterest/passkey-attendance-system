"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createUser } from "@/app/lib/api";
import {
	FormSheet,
	FormSheetCancelButton,
} from "@/components/custom/form-sheet";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-label";

interface CreateUserDialogProps {
	defaultRole?: string;
	allowedRoles?: string[];
	trigger: React.ReactNode;
}

export function CreateUserDialog({
	defaultRole = "",
	allowedRoles = ["student", "teacher", "admin"],
	trigger,
}: CreateUserDialogProps) {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);
	const [role, setRole] = React.useState(defaultRole);
	const [fullName, setFullName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [schoolId, setSchoolId] = React.useState("");
	const [program, setProgram] = React.useState("");
	const [yearLevel, setYearLevel] = React.useState(1);

	const isStudent = role === "student";
	const requiresSchoolId = role === "student" || role === "teacher";
	const roleOptions = React.useMemo(
		() =>
			allowedRoles.map((allowedRole) => ({
				value: allowedRole,
				label: allowedRole.charAt(0).toUpperCase() + allowedRole.slice(1),
			})),
		[allowedRoles],
	);
	const canSubmit =
		!submitting &&
		role !== "" &&
		fullName.trim() !== "" &&
		email.trim() !== "" &&
		(!requiresSchoolId || schoolId.trim() !== "") &&
		(!isStudent || (program.trim() !== "" && yearLevel >= 1));

	function reset() {
		setRole(defaultRole);
		setFullName("");
		setEmail("");
		setSchoolId("");
		setProgram("");
		setYearLevel(1);
	}

	async function handleSubmit() {
		if (!canSubmit) return;
		setSubmitting(true);
		try {
			await createUser({
				role,
				full_name: fullName.trim(),
				email: email.trim(),
				school_id: schoolId.trim() || null,
				program: program.trim() || null,
				year_level: yearLevel || null,
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
			title={allowedRoles.length === 1 ? `Create ${role}` : "Create user"}
			description={
				allowedRoles.length === 1
					? `Add a new ${role} account to the system.`
					: "Add a new user account to the system."
			}
			contentClassName="sm:max-w-xl"
			footer={
				<>
					<FormSheetCancelButton />
					<LoadingButton
						onClick={handleSubmit}
						loading={submitting}
						loadingText="Creating…"
						disabled={!canSubmit}
					>
						Create
					</LoadingButton>
				</>
			}
		>
			<FieldGroup>
				{allowedRoles.length > 1 && (
					<Field orientation="horizontal">
						<FieldLabel htmlFor="create-user-role">Role</FieldLabel>
						<Select
							value={role}
							onValueChange={(v) => {
								if (v !== null) setRole(v);
							}}
						>
							<SelectTrigger id="create-user-role" className="w-full">
								<SelectValue placeholder="Select a role">
									{getSelectLabel(role, roleOptions)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{roleOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				)}
				{allowedRoles.length > 1 && <FieldSeparator />}
				<Field>
					<FieldLabel htmlFor="create-user-name">Full name</FieldLabel>
					<Input
						id="create-user-name"
						value={fullName}
						onChange={(e) => setFullName(e.target.value)}
						placeholder="Juan Dela Cruz"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="create-user-email">Email</FieldLabel>
					<Input
						id="create-user-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="jdelacruz@example.edu.ph"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="create-user-school-id">
						School ID{requiresSchoolId ? "" : " (optional)"}
					</FieldLabel>
					<Input
						id="create-user-school-id"
						value={schoolId}
						onChange={(e) => setSchoolId(e.target.value)}
						placeholder="20210001"
					/>
				</Field>
				{isStudent && (
					<>
						<Field orientation="horizontal">
							<FieldLabel htmlFor="create-user-program">Program</FieldLabel>
							<Input
								id="create-user-program"
								value={program}
								onChange={(e) => setProgram(e.target.value)}
								placeholder="BSCS"
							/>
						</Field>
						<Field orientation="horizontal">
							<FieldLabel htmlFor="create-user-year">Year level</FieldLabel>
							<NumberStepper
								id="create-user-year"
								value={yearLevel}
								onChange={setYearLevel}
								min={1}
								max={6}
							/>
						</Field>
					</>
				)}
			</FieldGroup>
		</FormSheet>
	);
}
