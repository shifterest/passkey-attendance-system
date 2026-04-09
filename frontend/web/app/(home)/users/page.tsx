import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { getUsers } from "@/app/lib/api";
import { CreateUserDialog } from "@/components/custom/create-user-dialog";
import { DataTableUsers } from "@/components/custom/data-table-users";
import { ImportUsersDialog } from "@/components/custom/import-users-dialog";
import { PageHeader } from "@/components/custom/page-header";
import { Button } from "@/components/ui/button";

export default async function Page() {
	const users = await getUsers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Users"
				description="View and manage all users in the system."
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
			<DataTableUsers data={users} />
		</div>
	);
}
