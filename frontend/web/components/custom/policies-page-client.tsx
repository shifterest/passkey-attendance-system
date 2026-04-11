"use client";

import { IconRefresh } from "@tabler/icons-react";
import * as React from "react";
import {
	type ClassDto,
	type ClassPolicyDto,
	getClasses,
	getPolicies,
	getTeacherClasses,
	getTeachers,
	type TeacherDto,
} from "@/app/lib/api";
import { DataTablePolicies } from "@/components/custom/data-table-policies";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { useUser } from "@/components/custom/user-context";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type PolicyPageData = {
	policies: ClassPolicyDto[];
	classes: ClassDto[];
	teachers: TeacherDto[];
};

const EMPTY_DATA: PolicyPageData = {
	policies: [],
	classes: [],
	teachers: [],
};

export function PoliciesPageClient() {
	const { user, loading: userLoading } = useUser();
	const [data, setData] = React.useState<PolicyPageData>(EMPTY_DATA);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const loadData = React.useCallback(async () => {
		if (!user) {
			setData(EMPTY_DATA);
			setLoading(false);
			return;
		}

		if (!["teacher", "admin", "operator"].includes(user.role)) {
			setData(EMPTY_DATA);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			if (user.role === "teacher") {
				const [policies, classes] = await Promise.all([
					getPolicies(),
					getTeacherClasses(user.id),
				]);
				setData({ policies, classes, teachers: [] });
				return;
			}

			const [policies, classes, teachers] = await Promise.all([
				getPolicies(),
				getClasses(),
				getTeachers(),
			]);
			setData({ policies, classes, teachers });
		} catch (loadError) {
			console.error("Failed to load policies page", loadError);
			setError(
				loadError instanceof Error
					? loadError.message
					: "Policy data could not be loaded.",
			);
		} finally {
			setLoading(false);
		}
	}, [user]);

	React.useEffect(() => {
		if (userLoading) {
			return;
		}

		void loadData();
	}, [loadData, userLoading]);

	if (userLoading || loading) {
		return (
			<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
				<SetPageHeader
					title="Policies"
					description="Assurance thresholds and session window configuration."
				/>
				<Card>
					<CardHeader>
						<CardTitle>Loading policy workspace</CardTitle>
						<CardDescription>
							Fetching thresholds, ownership, and class targets.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (!user || !["teacher", "admin", "operator"].includes(user.role)) {
		return (
			<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
				<SetPageHeader
					title="Policies"
					description="Assurance thresholds and session window configuration."
				/>
				<Card>
					<CardHeader>
						<CardTitle>Policy access is unavailable</CardTitle>
						<CardDescription>
							Only teachers, admins, and operators can manage assurance policy.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
				<SetPageHeader
					title="Policies"
					description="Assurance thresholds and session window configuration."
				/>
				<Card>
					<CardHeader>
						<CardTitle>{error}</CardTitle>
						<CardDescription>
							Retry once the backend is reachable with a valid session.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button variant="outline" size="sm" onClick={() => void loadData()}>
							<IconRefresh data-icon="inline-start" />
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<DataTablePolicies
			policies={data.policies}
			classes={data.classes}
			teachers={data.teachers}
			currentUser={user}
			onRefresh={loadData}
		/>
	);
}
