import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { getTeachers } from "@/app/lib/api";
import { CreateUserDialog } from "@/components/custom/create-user-dialog";
import { DataTableTeachers } from "@/components/custom/data-table-teachers";
import { ImportUsersDialog } from "@/components/custom/import-users-dialog";
import { PageHeader } from "@/components/custom/page-header";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const teachers = await getTeachers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Teachers"
				description="View teacher accounts, class assignments, and session status."
				actions={
					<>
						<ImportUsersDialog
							trigger={
								<Button variant="outline" size="sm">
									<IconFileImport data-icon="inline-start" />
									Import
								</Button>
							}
						/>
						<CreateUserDialog
							defaultRole="teacher"
							allowedRoles={["teacher"]}
							trigger={
								<Button size="sm">
									<IconPlus data-icon="inline-start" />
									Create
								</Button>
							}
						/>
					</>
				}
			/>
			<DataTableTeachers data={teachers} />
		</div>
	);
}
