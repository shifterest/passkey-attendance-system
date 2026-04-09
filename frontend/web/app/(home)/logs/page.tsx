import { getAuditEvents } from "@/app/lib/api";
import { DataTableLogs } from "@/components/custom/data-table-logs";
import { PageHeader } from "@/components/custom/page-header";

export default async function Page() {
	const events = await getAuditEvents({ limit: 200 });
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<PageHeader
				title="Audit Log"
				description="Security events, attestation outcomes, and administrative actions."
			/>
			<DataTableLogs data={events} />
		</div>
	);
}
