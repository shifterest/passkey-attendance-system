import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { getClasses, getSemesters, getTeachers } from "@/app/lib/api";
import { CreateClassDialog } from "@/components/custom/create-class-dialog";
import { DataTableClasses } from "@/components/custom/data-table-classes";
import { ImportClassesDialog } from "@/components/custom/import-classes-dialog";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const [classes, teachers, semesters] = await Promise.all([
		getClasses(),
		getTeachers(),
		getSemesters(),
	]);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Classes"
				description="Manage courses, schedules, and assurance thresholds."
				actions={
					<div className="flex items-center gap-2">
						<ImportClassesDialog
							trigger={
								<Button variant="outline" size="sm">
									<IconFileImport data-icon="inline-start" />
									Import
								</Button>
							}
						/>
						<CreateClassDialog
							teachers={teachers}
							semesters={semesters}
							trigger={
								<Button size="sm">
									<IconPlus data-icon="inline-start" />
									Create
								</Button>
							}
						/>
					</div>
				}
			/>
			<DataTableClasses data={classes} teachers={teachers} />
		</div>
	);
}
