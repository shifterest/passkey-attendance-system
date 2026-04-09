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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function InfoRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className="text-sm">{children}</span>
		</div>
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
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-44" />
					<Skeleton className="h-44" />
					<Skeleton className="h-44" />
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
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>{user?.full_name}</CardTitle>
						<CardDescription>{user?.email}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<InfoRow label="Role">
							<Badge variant="outline" className="capitalize">
								{user?.role}
							</Badge>
						</InfoRow>
						{user?.school_id && (
							<InfoRow label="School ID">
								<span className="font-mono">{user.school_id}</span>
							</InfoRow>
						)}
						{user?.program && <InfoRow label="Program">{user.program}</InfoRow>}
						{user?.enrollment_year != null && (
							<InfoRow label="Enrollment Year">{user.enrollment_year}</InfoRow>
						)}
						{user?.year_level != null && (
							<InfoRow label="Year Level">{user.year_level}</InfoRow>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconFingerprint className="size-5 text-muted-foreground" />
							<CardTitle>Registration</CardTitle>
						</div>
						<CardDescription>
							Passkey and device key registration status.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<InfoRow label="Status">
							<Badge variant={user?.registered ? "default" : "outline"}>
								{user?.registered ? "Registered" : "Not registered"}
							</Badge>
						</InfoRow>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconShieldCheck className="size-5 text-muted-foreground" />
							<CardTitle>Security</CardTitle>
						</div>
						<CardDescription>
							Authentication is managed through the mobile app.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<div className="flex items-start gap-3 rounded-lg border p-3 text-xs text-muted-foreground">
							<IconDeviceMobile className="mt-0.5 size-4 shrink-0" />
							<span>
								Passkey management, device key rotation, and biometric settings
								are handled through the attendance app on your registered
								device.
							</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
