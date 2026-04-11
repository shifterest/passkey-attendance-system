import { notFound } from "next/navigation";
import { getOrgs } from "@/app/lib/api";
import { orgEventsEnabled } from "@/app/lib/features";
import { OrgList } from "@/components/custom/org-list";
import { SetPageHeader } from "@/components/custom/page-header-context";

export default async function Page() {
	if (!orgEventsEnabled) {
		notFound();
	}

	const orgs = await getOrgs();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SetPageHeader
				title="Organizations"
				description="Manage organizations and membership rules."
			/>
			<OrgList data={orgs} />
		</div>
	);
}
