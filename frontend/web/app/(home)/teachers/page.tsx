import { IconPlus } from "@tabler/icons-react";
import { getTeachers } from "@/app/lib/api";
import { CreateUserDialog } from "@/components/custom/create-user-dialog";
import { DataTableTeachers } from "@/components/custom/data-table-teachers";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const teachers = await getTeachers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Teachers"
				description="View teacher accounts, class assignments, and session status."
				actions={
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
				}
			/>
			<DataTableTeachers data={teachers} />
		</div>
	);
}
