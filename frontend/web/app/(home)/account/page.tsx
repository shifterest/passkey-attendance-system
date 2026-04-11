"use client";

import { UserRoleBadge } from "@/components/custom/data-table-cells";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { useUser } from "@/components/custom/user-context";
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

function InfoValue({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full text-left md:w-auto md:text-right">{children}</div>
	);
}

export default function AccountPage() {
	const { user, loading } = useUser();

	if (loading) {
		return (
			<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
				<SetPageHeader
					title="Account"
					description="View your account information."
				/>
				<div className="mx-auto w-full max-w-4xl">
					<FieldGroup>
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel>Identity</FieldLabel>
							</FieldContent>
							<Skeleton className="h-10 w-full md:w-64" />
						</Field>
					</FieldGroup>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
			<SetPageHeader
				title="Account"
				description="View your account information."
			/>
			<div className="mx-auto w-full max-w-4xl">
				<FieldGroup>
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Identity</FieldLabel>
						</FieldContent>
						<InfoValue>
							<div className="flex flex-col gap-1 md:items-end">
								<div className="text-sm font-medium">{user?.full_name}</div>
								<div className="text-sm text-muted-foreground">
									{user?.email}
								</div>
								{user?.role && <UserRoleBadge role={user.role} />}
							</div>
						</InfoValue>
					</Field>
					{user?.school_id && (
						<>
							<FieldSeparator />
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel>School ID</FieldLabel>
								</FieldContent>
								<InfoValue>
									<span className="font-mono text-sm">{user.school_id}</span>
								</InfoValue>
							</Field>
						</>
					)}
					{user?.program && (
						<>
							<FieldSeparator />
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel>Program</FieldLabel>
								</FieldContent>
								<InfoValue>
									<span className="text-sm">{user.program}</span>
								</InfoValue>
							</Field>
						</>
					)}
					{user?.enrollment_year != null && (
						<>
							<FieldSeparator />
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel>Enrollment year</FieldLabel>
								</FieldContent>
								<InfoValue>
									<span className="text-sm">{user.enrollment_year}</span>
								</InfoValue>
							</Field>
						</>
					)}
					{user?.year_level != null && (
						<>
							<FieldSeparator />
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel>Year level</FieldLabel>
								</FieldContent>
								<InfoValue>
									<span className="text-sm">{user.year_level}</span>
								</InfoValue>
							</Field>
						</>
					)}
				</FieldGroup>
			</div>
		</div>
	);
}
