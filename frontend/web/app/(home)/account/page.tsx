"use client";

import {
	IconDeviceMobile,
	IconFingerprint,
	IconShieldCheck,
} from "@tabler/icons-react";
import { SetPageHeader } from "@/components/custom/page-header-context";
import { useUser } from "@/components/custom/user-context";
import { Badge } from "@/components/ui/badge";
import {
	Field,
	FieldContent,
	FieldDescription,
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
			<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
				<SetPageHeader
					title="Account"
					description="View your account information."
				/>
				<div className="mx-auto w-full max-w-4xl">
					<FieldGroup>
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel>Identity</FieldLabel>
								<FieldDescription>
									Signed-in profile information.
								</FieldDescription>
							</FieldContent>
							<Skeleton className="h-10 w-full md:w-64" />
						</Field>
						<FieldSeparator />
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel>Registration</FieldLabel>
								<FieldDescription>
									Passkey and device key status.
								</FieldDescription>
							</FieldContent>
							<Skeleton className="h-6 w-28" />
						</Field>
						<FieldSeparator />
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel>Security</FieldLabel>
								<FieldDescription>
									Mobile-managed authentication state.
								</FieldDescription>
							</FieldContent>
							<Skeleton className="h-16 w-full md:w-80" />
						</Field>
					</FieldGroup>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<SetPageHeader
				title="Account"
				description="View your account information."
			/>
			<div className="mx-auto w-full max-w-4xl">
				<FieldGroup>
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Identity</FieldLabel>
							<FieldDescription>
								Primary account identity and role information.
							</FieldDescription>
						</FieldContent>
						<InfoValue>
							<div className="flex flex-col gap-1 md:items-end">
								<div className="text-sm font-medium">{user?.full_name}</div>
								<div className="text-sm text-muted-foreground">
									{user?.email}
								</div>
								<Badge
									variant="outline"
									className="w-fit capitalize md:self-end"
								>
									{user?.role}
								</Badge>
							</div>
						</InfoValue>
					</Field>
					{user?.school_id && (
						<>
							<FieldSeparator />
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel>School ID</FieldLabel>
									<FieldDescription>
										Institution-issued identifier.
									</FieldDescription>
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
									<FieldDescription>
										Academic or organizational program assignment.
									</FieldDescription>
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
									<FieldDescription>
										Explicit student enrollment year.
									</FieldDescription>
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
									<FieldDescription>
										Current year level exposed to admin surfaces.
									</FieldDescription>
								</FieldContent>
								<InfoValue>
									<span className="text-sm">{user.year_level}</span>
								</InfoValue>
							</Field>
						</>
					)}
					<FieldSeparator />
					<Field orientation="horizontal">
						<FieldContent>
							<div className="flex items-center gap-2">
								<IconFingerprint className="size-4 text-muted-foreground" />
								<FieldLabel>Registration</FieldLabel>
							</div>
							<FieldDescription>
								Passkey and device key enrollment status.
							</FieldDescription>
						</FieldContent>
						<InfoValue>
							<Badge variant={user?.registered ? "default" : "outline"}>
								{user?.registered ? "Registered" : "Not registered"}
							</Badge>
						</InfoValue>
					</Field>
					<FieldSeparator />
					<Field orientation="horizontal">
						<FieldContent>
							<div className="flex items-center gap-2">
								<IconShieldCheck className="size-4 text-muted-foreground" />
								<FieldLabel>Security</FieldLabel>
							</div>
							<FieldDescription>
								Authentication controls are managed in the mobile client.
							</FieldDescription>
						</FieldContent>
						<InfoValue>
							<div className="flex max-w-md items-start gap-3 rounded-3xl border px-4 py-3 text-sm text-muted-foreground md:justify-end">
								<IconDeviceMobile className="mt-0.5 size-4 shrink-0" />
								<span>
									Passkey management, device key rotation, and biometric
									settings are handled through the attendance app on your
									registered device.
								</span>
							</div>
						</InfoValue>
					</Field>
				</FieldGroup>
			</div>
		</div>
	);
}
