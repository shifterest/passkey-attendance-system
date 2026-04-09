import { getUsers } from "@/app/lib/api";
import { DataTableUsers } from "@/components/custom/data-table-users";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const users = await getUsers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Users"
				description="View and manage all users in the system."
			/>
			<DataTableUsers data={users} />
		</div>
	);
}
