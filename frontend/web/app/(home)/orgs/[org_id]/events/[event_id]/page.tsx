import { getEventRules } from "@/app/lib/api";
import { EventDetail } from "@/components/custom/event-detail";

export default async function Page({
	params,
}: { params: Promise<{ org_id: string; event_id: string }> }) {
	const { org_id, event_id } = await params;
	const rules = await getEventRules(event_id);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<EventDetail orgId={org_id} eventId={event_id} rules={rules} />
		</div>
	);
}
