"use client";

import { importEnrollments } from "@/app/lib/api";
import { ImportDialog } from "./import-dialog";

interface ImportEnrollmentsDialogProps {
	trigger: React.ReactNode;
}

export function ImportEnrollmentsDialog({
	trigger,
}: ImportEnrollmentsDialogProps) {
	return (
		<ImportDialog
			trigger={trigger}
			title="Import enrollments"
			description="Upload a CSV with columns: school_id, course_code. Students and classes must already exist."
			fileInputId="import-enrollments-file"
			onImport={(file, dryRun) => importEnrollments(file, dryRun)}
		/>
	);
}
