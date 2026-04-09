import { IconPlus } from "@tabler/icons-react";
import { getStudents } from "@/app/lib/api";
import { CreateUserDialog } from "@/components/custom/create-user-dialog";
import { DataTableStudent } from "@/components/custom/data-table-student";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const students = await getStudents();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Students"
				description="Manage student accounts, registrations, and enrollment status."
				actions={
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
				}
			/>
			<DataTableStudent data={students} />
		</div>
	);
}
