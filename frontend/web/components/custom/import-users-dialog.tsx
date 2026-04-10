"use client";

import * as React from "react";
import { importUsers } from "@/app/lib/api";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-label";
import { ImportDialog } from "./import-dialog";

const IMPORT_FORMAT_OPTIONS = [
	{
		value: "generic",
		label: "Generic (full_name, email, school_id, role)",
	},
	{
		value: "banner",
		label: "Banner (FIRST_NAME, LAST_NAME, EMAIL_ADDRESS, ID)",
	},
] as const;

interface ImportUsersDialogProps {
	trigger: React.ReactNode;
}

export function ImportUsersDialog({ trigger }: ImportUsersDialogProps) {
	const [format, setFormat] = React.useState<"generic" | "banner">("generic");

	return (
		<ImportDialog
			trigger={trigger}
			title="Import users"
			description="Upload a CSV file to bulk-create user accounts. Preview before committing."
			fileInputId="import-file"
			onImport={(file, dryRun) => importUsers(file, format, dryRun)}
			onReset={() => setFormat("generic")}
			extraFields={
				<Field>
					<FieldLabel htmlFor="import-format">CSV format</FieldLabel>
					<Select
						value={format}
						onValueChange={(v) => setFormat(v as "generic" | "banner")}
					>
						<SelectTrigger id="import-format" className="w-full">
							<SelectValue>
								{getSelectLabel(format, IMPORT_FORMAT_OPTIONS)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{IMPORT_FORMAT_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			}
		/>
	);
}
