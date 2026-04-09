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
import { ImportDialog } from "./import-dialog";

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
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="generic">
									Generic (full_name, email, school_id, role)
								</SelectItem>
								<SelectItem value="banner">
									Banner (FIRST_NAME, LAST_NAME, EMAIL_ADDRESS, ID)
								</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			}
		/>
	);
}
