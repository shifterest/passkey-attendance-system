"use client";

import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventRuleDto } from "@/app/lib/api";
import { createEventRule, deleteEventRule } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const EVENT_RULE_OPTIONS = [
	{ value: "all", label: "All Users" },
	{ value: "role", label: "User Role" },
	{ value: "program", label: "Program" },
	{ value: "year_level", label: "Year Level" },
	{ value: "org_member", label: "Organization Member" },
] as const;

type EventRuleType = (typeof EVENT_RULE_OPTIONS)[number]["value"];

export function EventDetail({
	orgId,
	eventId,
	rules,
}: {
	orgId: string;
	eventId: string;
	rules: EventRuleDto[];
}) {
	const router = useRouter();
	const [showAdd, setShowAdd] = useState(false);
	const [ruleType, setRuleType] = useState<EventRuleType>("all");
	const [ruleValue, setRuleValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requiresRuleValue = ruleType !== "all";

	async function handleAdd() {
		if (busy) return;
		const nextRuleValue = requiresRuleValue ? ruleValue.trim() : "";
		if (requiresRuleValue && !nextRuleValue) return;
		setBusy(true);
		setError(null);
		try {
			await createEventRule(eventId, {
				rule_type: ruleType,
				rule_value: nextRuleValue,
			});
			setRuleType("all");
			setRuleValue("");
			setShowAdd(false);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add rule");
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete(ruleId: string) {
		try {
			await deleteEventRule(eventId, ruleId);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to delete rule");
		}
	}

	return (
		<div className="px-4 lg:px-6 flex flex-col gap-4">
			<Button
				variant="ghost"
				className="gap-1 pl-0 w-fit"
				render={<Link href={`/orgs/${orgId}`} />}
			>
				<IconArrowLeft data-icon="inline-start" />
				Back to organization
			</Button>

			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Attendee Rules</h3>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
				>
					<IconPlus data-icon="inline-start" />
					Add
				</Button>
			</div>

			{showAdd && (
				<Card className="mb-2">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Select
								value={ruleType}
								onValueChange={(value) => {
									if (value) {
										setRuleType(value as EventRuleType);
										if (value === "all") {
											setRuleValue("");
										}
									}
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EVENT_RULE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{requiresRuleValue && (
								<Input
									placeholder={
										ruleType === "org_member" ? "Organization ID" : "Rule value"
									}
									value={ruleValue}
									onChange={(e) => setRuleValue(e.target.value)}
								/>
							)}
							{error && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</div>
							)}
							<Button
								onClick={handleAdd}
								disabled={busy || (requiresRuleValue && !ruleValue.trim())}
							>
								{busy ? "Adding..." : "Add Rule"}
							</Button>
						</div>
					</CardHeader>
				</Card>
			)}

			{rules.length === 0 ? (
				<p className="text-muted-foreground text-sm">No attendee rules.</p>
			) : (
				<div className="grid gap-2">
					{rules.map((r) => (
						<Card key={r.id}>
							<CardHeader className="flex-row items-center justify-between py-3">
								<div className="flex items-center gap-2">
									<Badge variant="outline">{r.rule_type}</Badge>
									<span className="text-sm">{r.rule_value}</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleDelete(r.id)}
								>
									<IconTrash />
								</Button>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
