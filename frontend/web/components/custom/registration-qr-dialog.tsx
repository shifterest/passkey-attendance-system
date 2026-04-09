import { QRCodeSVG } from "qrcode.react";
import type { RegistrationSessionDto } from "@/app/lib/api";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

function formatExpiry(seconds: number): string {
	if (seconds >= 3600) {
		const h = Math.floor(seconds / 3600);
		return `${h} hour${h > 1 ? "s" : ""}`;
	}
	const m = Math.ceil(seconds / 60);
	return `${m} minute${m > 1 ? "s" : ""}`;
}

export function RegistrationQrDialog({
	open,
	onOpenChange,
	session,
	fullName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	session: RegistrationSessionDto | null;
	fullName?: string;
}) {
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
					<div className="inline-flex rounded-lg border bg-white p-3">
						<QRCodeSVG
							value={session.url}
							size={200}
							level="H"
							marginSize={2}
						/>
					</div>
				</div>
				<DialogFooter className="justify-center sm:justify-center">
					<p className="text-center text-xs text-muted-foreground">
						This code expires in {formatExpiry(session.expires_in)}. The dialog
						will close automatically once registration is complete.
					</p>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
