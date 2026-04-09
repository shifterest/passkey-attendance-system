import { getUsers } from "@/app/lib/api";
import { DataTableUsers } from "@/components/custom/data-table-users";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const allUsers = await getUsers();
	const admins = allUsers.filter((u) => ["admin", "operator"].includes(u.role));
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Admins & Operators"
				description="Manage privileged user accounts."
			/>
			<DataTableUsers data={admins} />
		</div>
	);
}
