import { getOrgs } from "@/app/lib/api";
import { OrgList } from "@/components/custom/org-list";

export default async function Page() {
	const orgs = await getOrgs();
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<OrgList data={orgs} />
		</div>
	);
}
