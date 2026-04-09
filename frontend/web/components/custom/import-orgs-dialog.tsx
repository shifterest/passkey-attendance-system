"use client";

import { importOrgs } from "@/app/lib/api";
import { ImportDialog } from "./import-dialog";

interface ImportOrgsDialogProps {
	trigger: React.ReactNode;
}

export function ImportOrgsDialog({ trigger }: ImportOrgsDialogProps) {
	return (
		<ImportDialog
			trigger={trigger}
			title="Import organizations"
			description="Upload a CSV with columns: name, description (optional)."
			fileInputId="import-orgs-file"
			onImport={(file, dryRun) => importOrgs(file, dryRun)}
		/>
	);
}
