import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { RegistrationSessionDto } from "@/app/lib/api";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

function formatCountdown(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RegistrationQrDialog({
	open,
	onOpenChange,
	session,
	fullName,
	onExpired,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	session: RegistrationSessionDto | null;
	fullName?: string;
	onExpired?: () => void;
}) {
	const [remaining, setRemaining] = useState<number | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (!open || !session) {
			setRemaining(null);
			setRegenerating(false);
			return;
		}

		setRemaining(session.expires_in);
		setRegenerating(false);

		intervalRef.current = setInterval(() => {
			setRemaining((prev) => {
				if (prev === null || prev <= 1) {
					if (intervalRef.current) {
						clearInterval(intervalRef.current);
						intervalRef.current = null;
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [open, session]);

	useEffect(() => {
		if (remaining === 0 && onExpired) {
			setRegenerating(true);
			onExpired();
		}
	}, [remaining, onExpired]);

	if (session === null) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Registration unavailable</DialogTitle>
						<DialogDescription>
							Could not start a registration session. Please try again.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader className="text-center">
					<DialogTitle>
						{fullName ? `Register ${fullName}` : "Register user"}
					</DialogTitle>
					<DialogDescription>
						Open the attendance app and scan this code to register a passkey and
						device key.
					</DialogDescription>
				</DialogHeader>
				<div className="flex justify-center">
					{regenerating ? (
						<div className="flex h-[224px] w-[224px] items-center justify-center rounded-lg border bg-white">
							<Spinner className="size-6" />
						</div>
					) : (
						<div className="inline-flex rounded-lg border bg-white p-3">
							<QRCodeSVG
								value={session.url}
								size={200}
								level="H"
								marginSize={2}
							/>
						</div>
					)}
				</div>
				<DialogFooter className="justify-center sm:justify-center">
					<p className="text-center text-xs text-muted-foreground">
						{regenerating
							? "Regenerating QR code..."
							: remaining !== null && remaining > 0
								? `Expires in ${formatCountdown(remaining)}. The dialog will close automatically once registration is complete.`
								: "The dialog will close automatically once registration is complete."}
					</p>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
