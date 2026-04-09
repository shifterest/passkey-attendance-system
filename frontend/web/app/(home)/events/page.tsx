import { getAllEvents, getOrgs } from "@/app/lib/api";
import { DataTableEvents } from "@/components/custom/data-table-events";
import { SetPageHeader } from "@/components/custom/page-header-context";

export default async function EventsPage() {
	const [events, orgs] = await Promise.all([getAllEvents(), getOrgs()]);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Events"
				description="Organization events and attendance sessions."
			/>
			<DataTableEvents events={events} orgs={orgs} />
		</div>
	);
}
