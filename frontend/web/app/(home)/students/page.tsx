import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { getStudents } from "@/app/lib/api";
import { CreateUserDialog } from "@/components/custom/create-user-dialog";
import { DataTableStudent } from "@/components/custom/data-table-student";
import { ImportUsersDialog } from "@/components/custom/import-users-dialog";
import { PageHeader } from "@/components/custom/page-header";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const students = await getStudents();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Students"
				description="Manage student accounts, registrations, and enrollment status."
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
							defaultRole="student"
							allowedRoles={["student"]}
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
			<DataTableStudent data={students} />
		</div>
	);
}
