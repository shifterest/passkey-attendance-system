import { RegistrationSessionDto } from "@/app/lib/api";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Register user</DialogTitle>
						<DialogDescription>
							There was an error in getting a registration session.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Register user</DialogTitle>
					<DialogDescription>
						The user {fullName ? `(${fullName})` : ""} must scan this QR code to
						register their device and passkey.
					</DialogDescription>
				</DialogHeader>
				<div className="flex justify-center px-4">
					<QRCodeSVG value={session.url} size={256} level="H" marginSize={4} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
