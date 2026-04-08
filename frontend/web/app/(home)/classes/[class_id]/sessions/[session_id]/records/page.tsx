import { IconChevronLeft } from "@tabler/icons-react";
import Link from "next/link";
import { getRecordsBySession } from "@/app/lib/api";
import { DataTableRecords } from "@/components/custom/data-table-records";
import { Button } from "@/components/ui/button";

export default async function Page({
	params,
}: {
	params: Promise<{ class_id: string; session_id: string }>;
}) {
	const { class_id, session_id } = await params;
	const records = await getRecordsBySession(session_id);
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="px-4 lg:px-6">
				<Button
					variant="ghost"
					className="gap-1 pl-0"
					render={<Link href={`/classes/${class_id}/sessions`} />}
				>
					<IconChevronLeft data-icon="inline-start" />
					Back to Sessions
				</Button>
			</div>
			<DataTableRecords data={records} />
		</div>
	);
}
