import { IconChevronLeft } from "@tabler/icons-react";
import { getSessionsByClass } from "@/app/lib/api";
import { DataTableSessions } from "@/components/custom/data-table-sessions";
import { TransitionLink } from "@/components/custom/navigation-transition";
import { Button } from "@/components/ui/button";

export default async function Page({
	params,
}: {
	params: Promise<{ class_id: string }>;
}) {
	const { class_id } = await params;
	const sessions = await getSessionsByClass(class_id, { limit: 100 });
	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="px-4 lg:px-6">
				<Button
					variant="ghost"
					className="gap-1 pl-0"
					render={<TransitionLink href="/classes" />}
				>
					<IconChevronLeft data-icon="inline-start" />
					Back to Classes
				</Button>
			</div>
			<DataTableSessions data={sessions} />
		</div>
	);
}
