"use client";

import {
	IconBrandGithub,
	IconChevronRight,
	IconInfoCircle,
	IconKey,
	IconPassword,
	IconShoe,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

// TODO: Throw error if can't connect to API
export default function LoginPage() {
	const router = useRouter();
	const [isBootstrapMode, setIsBootstrapMode] = useState(false);
	const [loading, setLoading] = useState(true);
	const [bootstrapping, setBootstrapping] = useState(false);

	useEffect(() => {
		const checkBootstrap = async () => {
			try {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_ORIGIN}/bootstrap/status`,
				);
				const data = await response.json();
				setIsBootstrapMode(data);
			} catch (error) {
				console.error("Failed to check bootstrap status", error);
			} finally {
				setLoading(false);
			}
		};

		checkBootstrap();
	}, []);

	const bootstrap = async () => {
		setBootstrapping(true);
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_ORIGIN}/bootstrap/operator`,
				{
					method: "POST",
				},
			);
			const data = await response.json();
			localStorage.setItem("user_id", data.user_id);
			localStorage.setItem("session_token", data.session_token);
			// TODO: Implement token expiration handling
			localStorage.setItem("expires_in", data.expires_in);
			router.push("/dashboard");
		} catch (error) {
			console.error("Failed to bootstrap", error);
		} finally {
			setBootstrapping(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-svh">
				<Spinner className="size-6" />
			</div>
		);
	}

	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Passkey Attendance System</CardTitle>
						<CardDescription>Select any of the options below</CardDescription>
						<CardAction>
							<Dialog>
								<DialogTrigger
									render={
										<Button variant="outline">
											<IconInfoCircle />
										</Button>
									}
								/>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>PAS Demo</DialogTitle>
										<DialogDescription>
											This system is based on the study:
											<i>
												"A FIDO2 Passkey Attendance System Using Two-Factor
												Proximity and Credential-Based Authentication"
											</i>
											.
										</DialogDescription>
									</DialogHeader>
									<p>
										Developed with 🩷 <b>love</b> by:
									</p>
									<ul className="grid gap-2 text-sm">
										<li className="flex gap-2">
											<IconChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
											<span>Jane Heart Cabahug</span>
										</li>
										<li className="flex gap-2">
											<IconChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
											<span>Kenji Delmoro</span>
										</li>
										<li className="flex gap-2">
											<IconChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
											<span>Christen Iris Gregorio</span>
										</li>
										<li className="flex gap-2">
											<IconChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
											<span>John Tristan Valdez</span>
										</li>
									</ul>
									<DialogFooter>
										<Link
											href="https://github.com/shifterest/passkey-attendance-system"
											target="_blank"
										>
											<Button className="w-full">
												<IconBrandGithub data-icon="inline-start" />
												View on GitHub
											</Button>
										</Link>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</CardAction>
					</CardHeader>
					<CardContent>
						<Field>
							{isBootstrapMode ? (
								<Button onClick={bootstrap} disabled={bootstrapping}>
									{loading ? (
										<Spinner data-icon="inline-start" />
									) : (
										<IconShoe data-icon="inline-start" />
									)}
									Bootstrap and auto-login
								</Button>
							) : (
								<>
									<Button>
										<IconKey data-icon="inline-start" />
										Login with passkey
									</Button>
									<Button variant="outline">
										<IconPassword data-icon="inline-start" />
										Login with password and 2FA
									</Button>
									<FieldDescription className="text-center">
										{/* TODO: Add dialog to proceed to MIS office for account registration*/}
										Don't have access to your account yet?{" "}
										<a href="#!">Register</a>
									</FieldDescription>
								</>
							)}
						</Field>
					</CardContent>
				</Card>
				<FieldDescription className="px-6 text-center">
					By clicking continue, you agree to our{" "}
					<a href="#!">Terms of Service</a> and <a href="#!">Privacy Policy</a>.
				</FieldDescription>
			</div>
		</div>
	);
}
