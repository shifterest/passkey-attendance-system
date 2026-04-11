"use client";

import {
	IconBrandGithub,
	IconChevronRight,
	IconInfoCircle,
	IconRefresh,
	IconShoe,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BootstrapStatusDto,
	getBootstrapStatus,
	persistBrowserSession,
	type WebLoginInitiateDto,
	webLoginInitiate,
	webLoginPoll,
} from "@/app/lib/api";
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

export default function LoginPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [phase, setPhase] = useState<BootstrapStatusDto["phase"]>("completed");
	const [registrationUrl, setRegistrationUrl] = useState<string | null>(null);

	const [bootstrapDialogOpen, setBootstrapDialogOpen] = useState(false);
	const [bootstrapping, setBootstrapping] = useState(false);
	const [bootstrapTokenInput, setBootstrapTokenInput] = useState("");
	const [bootstrapTokenInvalid, setBootstrapTokenInvalid] = useState(false);
	const [bootstrapRateLimitSeconds, setBootstrapRateLimitSeconds] = useState<
		number | null
	>(null);
	const [bootstrapError, setBootstrapError] = useState<string | null>(null);

	const [webLogin, setWebLogin] = useState<WebLoginInitiateDto | null>(null);
	const [webLoginError, setWebLoginError] = useState(false);
	const [webLoginTtl, setWebLoginTtl] = useState<number | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ttlRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (localStorage.getItem("session_token")) {
			router.replace("/dashboard");
			return;
		}

		const init = async () => {
			try {
				const status = await getBootstrapStatus();
				setPhase(status.phase);
				if (status.registration_url) {
					setRegistrationUrl(status.registration_url);
				}
			} catch (error) {
				console.error("Failed to check bootstrap status", error);
			} finally {
				setLoading(false);
			}
		};

		init();
	}, [router]);

	useEffect(() => {
		if (phase !== "pending_registration") return;

		const intervalId = window.setInterval(async () => {
			try {
				const status = await getBootstrapStatus();
				if (status.phase === "completed" || status.phase === "disabled") {
					setPhase(status.phase);
				}
			} catch {
				// transient; keep polling
			}
		}, 3000);

		return () => window.clearInterval(intervalId);
	}, [phase]);

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
		setBootstrapError(null);
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_ORIGIN}/bootstrap/operator`,
				{
					method: "POST",
					headers: { "X-Bootstrap-Token": token },
				},
			);
			if (response.status === 429) {
				const retryAfter = Number.parseInt(
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
			setRegistrationUrl(data.registration_url);
			setPhase("pending_registration");
			setBootstrapDialogOpen(false);
		} catch (error) {
			console.error("Failed to bootstrap", error);
			setBootstrapError("Something went wrong. Please try again.");
		} finally {
			setBootstrapping(false);
		}
	};

	const stopPolling = useCallback(() => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}, []);

	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current) {
			clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = null;
		}
	}, []);

	const clearTtlTimer = useCallback(() => {
		if (ttlRef.current) {
			clearInterval(ttlRef.current);
			ttlRef.current = null;
		}
	}, []);

	const startWebLoginRef = useRef<(() => Promise<void>) | null>(null);

	const startWebLogin = useCallback(async () => {
		setWebLoginError(false);
		clearTtlTimer();
		try {
			const data = await webLoginInitiate();
			setWebLogin(data);
			setWebLoginTtl(data.ttl);

			stopPolling();
			pollRef.current = setInterval(async () => {
				try {
					const result = await webLoginPoll(data.token);
					if (result.status === "completed" && result.session) {
						stopPolling();
						clearRefreshTimer();
						clearTtlTimer();
						await persistBrowserSession(result.session);
						router.push("/dashboard");
					}
					if (result.status === "consumed") {
						stopPolling();
						clearRefreshTimer();
						clearTtlTimer();
						startWebLoginRef.current?.();
					}
				} catch {
					// poll errors are transient; keep trying
				}
			}, data.poll_interval * 1000);

			clearRefreshTimer();
			refreshTimerRef.current = setTimeout(() => {
				stopPolling();
				clearTtlTimer();
				startWebLoginRef.current?.();
			}, data.ttl * 1000);

			ttlRef.current = setInterval(() => {
				setWebLoginTtl((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
			}, 1000);
		} catch {
			setWebLoginError(true);
		}
	}, [stopPolling, clearRefreshTimer, clearTtlTimer, router]);

	startWebLoginRef.current = startWebLogin;

	useEffect(() => {
		if (phase === "completed" || phase === "disabled") {
			startWebLogin();
		}
		return () => {
			stopPolling();
			clearRefreshTimer();
			clearTtlTimer();
		};
	}, [phase, startWebLogin, stopPolling, clearRefreshTimer, clearTtlTimer]);

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
						<CardDescription>
							{phase === "ready" && "Bootstrap required"}
							{phase === "pending_registration" && "Scan QR to finish setup"}
							{(phase === "completed" || phase === "disabled") &&
								"Scan with your phone to sign in"}
						</CardDescription>
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
						{phase === "ready" && (
							<Field>
								<Button onClick={() => setBootstrapDialogOpen(true)}>
									<IconShoe data-icon="inline-start" />
									Set up operator account
								</Button>
								<FieldDescription className="text-center">
									Enter the bootstrap token to begin setting up the operator
									account.
								</FieldDescription>
							</Field>
						)}

						{phase === "pending_registration" && registrationUrl && (
							<div className="flex flex-col items-center gap-4">
								<QRCodeSVG
									value={registrationUrl}
									size={224}
									level="H"
									marginSize={4}
								/>
								<FieldDescription className="text-center">
									Scan this QR code with the PAS app to register the operator
									device and passkey. This page will update automatically once
									registration is complete.
								</FieldDescription>
							</div>
						)}

						{(phase === "completed" || phase === "disabled") && (
							<div className="flex flex-col items-center gap-4">
								{webLoginError ? (
									<>
										<FieldDescription className="text-destructive text-center">
											Could not connect to the server.
										</FieldDescription>
										<Button
											variant="outline"
											className="w-full"
											onClick={startWebLogin}
										>
											<IconRefresh data-icon="inline-start" />
											Retry
										</Button>
									</>
								) : webLogin ? (
									<>
										<QRCodeSVG
											value={webLogin.url}
											size={224}
											level="H"
											marginSize={4}
										/>
										<FieldDescription className="text-center">
											Open the PAS app, scan this code, and authenticate with
											your passkey.
											{webLoginTtl !== null && webLoginTtl > 0 && (
												<>
													<br />
													Refreshes in {webLoginTtl}s
												</>
											)}
										</FieldDescription>
									</>
								) : (
									<Spinner className="size-6" />
								)}
							</div>
						)}
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
						setBootstrapError(null);
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
								Enter the token printed in the server logs to create the
								operator account.
							</DialogDescription>
						</DialogHeader>
						<Field>
							<Input
								placeholder="Token"
								value={bootstrapTokenInput}
								onChange={(e) => {
									setBootstrapTokenInput(e.target.value);
									setBootstrapTokenInvalid(false);
									setBootstrapError(null);
								}}
								aria-invalid={bootstrapTokenInvalid || undefined}
								disabled={bootstrapping || !!bootstrapRateLimitSeconds}
							/>
							{bootstrapTokenInvalid && (
								<FieldDescription className="text-destructive">
									The bootstrap token is not valid.
								</FieldDescription>
							)}
							{bootstrapError && (
								<FieldDescription className="text-destructive">
									{bootstrapError}
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
