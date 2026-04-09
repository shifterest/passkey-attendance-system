import { getAllEvents, getOrgs } from "@/app/lib/api";
import { DataTableEvents } from "@/components/custom/data-table-events";

export default async function EventsPage() {
	const [events, orgs] = await Promise.all([getAllEvents(), getOrgs()]);
	return <DataTableEvents events={events} orgs={orgs} />;
}
