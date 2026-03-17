import { getUsers } from "@/app/lib/api";
import { DataTableUsers } from "@/components/custom/data-table-users";

export default async function Page() {
	const users = await getUsers();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<DataTableUsers data={users} />
		</div>
	);
}
