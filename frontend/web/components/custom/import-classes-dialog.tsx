"use client";

import { importClasses } from "@/app/lib/api";
import { ImportDialog } from "./import-dialog";

interface ImportClassesDialogProps {
	trigger: React.ReactNode;
}

export function ImportClassesDialog({ trigger }: ImportClassesDialogProps) {
	return (
		<ImportDialog
			trigger={trigger}
			title="Import classes"
			description="Upload a CSV with columns: course_code, course_name, teacher_email. Schedule can be added after import."
			fileInputId="import-classes-file"
			onImport={(file, dryRun) => importClasses(file, dryRun)}
		/>
	);
}
