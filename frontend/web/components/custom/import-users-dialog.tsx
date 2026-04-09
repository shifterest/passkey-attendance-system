"use client";

import { IconFileImport, IconUpload } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { type ImportUsersResult, importUsers } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface ImportUsersDialogProps {
	trigger: React.ReactNode;
}

export function ImportUsersDialog({ trigger }: ImportUsersDialogProps) {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [file, setFile] = React.useState<File | null>(null);
	const [format, setFormat] = React.useState<"generic" | "banner">("generic");
	const [submitting, setSubmitting] = React.useState(false);
	const [result, setResult] = React.useState<ImportUsersResult | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const fileRef = React.useRef<HTMLInputElement>(null);

	function reset() {
		setFile(null);
		setFormat("generic");
		setResult(null);
		setError(null);
		if (fileRef.current) fileRef.current.value = "";
	}

	async function handlePreview() {
		if (!file || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			const r = await importUsers(file, format, true);
			setResult(r);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleImport() {
		if (!file || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			const r = await importUsers(file, format, false);
			setResult(r);
			if (r.created > 0) {
				router.refresh();
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed");
		} finally {
			setSubmitting(false);
		}
	}

	const isCommitted = result && !result.dry_run;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger
				render={React.isValidElement(trigger) ? trigger : undefined}
			>
				{!React.isValidElement(trigger) && trigger}
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Import users</DialogTitle>
					<DialogDescription>
						Upload a CSV file to bulk-create user accounts. Preview before
						committing.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="import-format">CSV format</FieldLabel>
						<Select
							value={format}
							onValueChange={(v) => setFormat(v as "generic" | "banner")}
						>
							<SelectTrigger id="import-format" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="generic">
										Generic (full_name, email, school_id, role)
									</SelectItem>
									<SelectItem value="banner">
										Banner (FIRST_NAME, LAST_NAME, EMAIL_ADDRESS, ID)
									</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="import-file">CSV file</FieldLabel>
						<input
							ref={fileRef}
							id="import-file"
							type="file"
							accept=".csv,text/csv"
							className="text-sm file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
							onChange={(e) => {
								setFile(e.target.files?.[0] ?? null);
								setResult(null);
								setError(null);
							}}
						/>
					</Field>
				</FieldGroup>
				{error && (
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</div>
				)}
				{result && (
					<div className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
						<div className="flex items-center gap-2">
							<Badge variant={result.dry_run ? "outline" : "default"}>
								{result.dry_run ? "Preview" : "Committed"}
							</Badge>
							<span>
								{result.created} to create · {result.skipped} skipped
								{result.errors.length > 0 &&
									` · ${result.errors.length} error(s)`}
							</span>
						</div>
						{result.errors.length > 0 && (
							<div className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
								{result.errors.map((err) => (
									<div key={`row-${err.row}`}>
										Row {err.row}: {err.reason}
									</div>
								))}
							</div>
						)}
					</div>
				)}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						{isCommitted ? "Done" : "Cancel"}
					</DialogClose>
					{!isCommitted && (
						<>
							<Button
								variant="outline"
								onClick={handlePreview}
								disabled={!file || submitting}
							>
								{submitting ? "Checking…" : "Preview"}
							</Button>
							<Button onClick={handleImport} disabled={!file || submitting}>
								<IconUpload data-icon="inline-start" />
								{submitting ? "Importing…" : "Import"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
