import { getEvents, getOrgMembers, getOrgRules } from "@/app/lib/api";
import { OrgDetail } from "@/components/custom/org-detail";

export default async function Page({
	params,
}: {
	params: Promise<{ org_id: string }>;
}) {
	const { org_id } = await params;
	const [members, rules, events] = await Promise.all([
		getOrgMembers(org_id),
		getOrgRules(org_id),
		getEvents(org_id),
	]);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<OrgDetail
				orgId={org_id}
				members={members}
				rules={rules}
				events={events}
			/>
		</div>
	);
}
