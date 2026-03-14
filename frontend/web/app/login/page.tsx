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
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// TODO: Throw error if can't connect to API
export default function LoginPage() {
	const router = useRouter();
	const [isBootstrapMode, setIsBootstrapMode] = useState(false);
	const [loading, setLoading] = useState(true);
	const [bootstrapping, setBootstrapping] = useState(false);
	const [bootstrapDialogOpen, setBootstrapDialogOpen] = useState(false);
	const [bootstrapTokenInput, setBootstrapTokenInput] = useState("");
	const [bootstrapTokenInvalid, setBootstrapTokenInvalid] = useState(false);
	const [bootstrapRateLimitSeconds, setBootstrapRateLimitSeconds] = useState<
		number | null
	>(null);

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

	useEffect(() => {
		if (!bootstrapRateLimitSeconds) return;
		const timer = setTimeout(() => {
			setBootstrapRateLimitSeconds((prev) =>
				prev && prev > 1 ? prev - 1 : null,
			);
		}, 1000);
		return () => clearTimeout(timer);
	}, [bootstrapRateLimitSeconds]);

	const bootstrap = async (token: string) => {
		setBootstrapping(true);
		setBootstrapTokenInvalid(false);
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_ORIGIN}/bootstrap/operator`,
				{
					method: "POST",
					headers: {
						"X-Bootstrap-Token": token,
					},
				},
			);
			if (response.status === 429) {
				const retryAfter = parseInt(
					response.headers.get("Retry-After") ?? "60",
					10,
				);
				setBootstrapRateLimitSeconds(retryAfter);
				return;
			}
			if (response.status === 401) {
				setBootstrapTokenInvalid(true);
				return;
			}
			if (!response.ok) {
				throw new Error(await response.text());
			}
			const data = await response.json();
			localStorage.setItem("user_id", data.user_id);
			localStorage.setItem("session_token", data.session_token);
			// TODO: Implement token expiration handling
			localStorage.setItem("expires_in", data.expires_in);
			setBootstrapDialogOpen(false);
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
								<Button
									onClick={() => setBootstrapDialogOpen(true)}
									disabled={bootstrapping}
								>
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
			<Dialog
				open={bootstrapDialogOpen}
				onOpenChange={(open) => {
					setBootstrapDialogOpen(open);
					if (!open) {
						setBootstrapTokenInput("");
						setBootstrapTokenInvalid(false);
					}
				}}
			>
				<DialogContent showCloseButton={false}>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							bootstrap(bootstrapTokenInput);
						}}
						className="grid gap-4"
					>
						<DialogHeader>
							<DialogTitle>Enter bootstrap token</DialogTitle>
							<DialogDescription>
								Bootstrap the system with an operator account using a valid
								token.
							</DialogDescription>
						</DialogHeader>
						<Field>
							<Input
								placeholder="Token"
								value={bootstrapTokenInput}
								onChange={(e) => {
									setBootstrapTokenInput(e.target.value);
									setBootstrapTokenInvalid(false);
								}}
								aria-invalid={bootstrapTokenInvalid || undefined}
								disabled={bootstrapping || !!bootstrapRateLimitSeconds}
							/>
							{bootstrapTokenInvalid && (
								<FieldDescription className="text-destructive">
									The bootstrap token is not valid.
								</FieldDescription>
							)}
							{!!bootstrapRateLimitSeconds && (
								<FieldDescription className="text-destructive">
									You are being rate limited. Try again in{" "}
									{bootstrapRateLimitSeconds} second(s).
								</FieldDescription>
							)}
						</Field>
						<DialogFooter>
							<DialogClose
								render={
									<Button variant="outline" type="button">
										Cancel
									</Button>
								}
							/>
							<Button
								type="submit"
								disabled={bootstrapping || !!bootstrapRateLimitSeconds}
							>
								{bootstrapping && <Spinner data-icon="inline-start" />}
								Enter
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
