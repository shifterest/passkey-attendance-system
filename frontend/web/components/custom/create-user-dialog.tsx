"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createUser } from "@/app/lib/api";
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
	const [yearLevel, setYearLevel] = React.useState("");

	const isStudent = role === "student";
	const canSubmit =
		!submitting &&
		role !== "" &&
		fullName.trim() !== "" &&
		email.trim() !== "" &&
		(!isStudent || (program.trim() !== "" && yearLevel !== ""));

	function reset() {
		setRole(defaultRole);
		setFullName("");
		setEmail("");
		setSchoolId("");
		setProgram("");
		setYearLevel("");
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
				year_level: yearLevel ? Number(yearLevel) : null,
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
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{allowedRoles.length === 1 ? `Create ${role}` : "Create user"}
					</DialogTitle>
					<DialogDescription>
						{allowedRoles.length === 1
							? `Add a new ${role} account to the system.`
							: "Add a new user account to the system."}
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					{allowedRoles.length > 1 && (
						<Field>
							<FieldLabel htmlFor="create-user-role">Role</FieldLabel>
							<Select
								value={role}
								onValueChange={(v) => {
									if (v !== null) setRole(v);
								}}
							>
								<SelectTrigger id="create-user-role" className="w-full">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{allowedRoles.map((r) => (
											<SelectItem key={r} value={r}>
												{r.charAt(0).toUpperCase() + r.slice(1)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					)}
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
							School ID (optional)
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
							<Field>
								<FieldLabel htmlFor="create-user-program">Program</FieldLabel>
								<Input
									id="create-user-program"
									value={program}
									onChange={(e) => setProgram(e.target.value)}
									placeholder="BSCS"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="create-user-year">Year level</FieldLabel>
								<Input
									id="create-user-year"
									type="number"
									min={1}
									max={6}
									value={yearLevel}
									onChange={(e) => setYearLevel(e.target.value)}
									placeholder="1"
								/>
							</Field>
						</>
					)}
				</FieldGroup>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{submitting ? "Creating…" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
