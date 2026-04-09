"use client";

import { useUser } from "@/components/custom/user-context";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountPage() {
	const { user, loading } = useUser();

	if (loading) {
		return (
			<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
				<div>
					<Skeleton className="h-7 w-40" />
					<Skeleton className="mt-1 h-4 w-64" />
				</div>
				<Separator />
				<Skeleton className="h-40 w-full max-w-md" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
			<div>
				<h2 className="text-xl font-semibold">Account</h2>
				<p className="text-sm text-muted-foreground">
					View your account information.
				</p>
			</div>
			<Separator />
			<Card className="max-w-md">
				<CardHeader>
					<CardTitle>{user?.full_name}</CardTitle>
					<CardDescription>{user?.email}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Role</span>
						<Badge variant="outline" className="capitalize">
							{user?.role}
						</Badge>
					</div>
					{user?.school_id && (
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">School ID</span>
							<span className="font-mono text-sm">{user.school_id}</span>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
