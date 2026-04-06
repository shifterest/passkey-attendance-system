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
	const [ruleType, setRuleType] = useState("email_domain");
	const [ruleValue, setRuleValue] = useState("");
	const [busy, setBusy] = useState(false);

	async function handleAdd() {
		if (!ruleValue.trim() || busy) return;
		setBusy(true);
		try {
			await createEventRule(eventId, {
				rule_type: ruleType,
				rule_value: ruleValue.trim(),
			});
			setRuleValue("");
			setShowAdd(false);
			router.refresh();
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete(ruleId: string) {
		await deleteEventRule(eventId, ruleId);
		router.refresh();
	}

	return (
		<div className="px-4 lg:px-6 flex flex-col gap-4">
			<Link
				href={`/orgs/${orgId}`}
				className="flex items-center gap-1 text-sm text-muted-foreground hover:underline w-fit"
			>
				<IconArrowLeft className="size-4" />
				Back to organization
			</Link>

			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Attendee Rules</h3>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
				>
					<IconPlus className="mr-1 size-4" />
					Add
				</Button>
			</div>

			{showAdd && (
				<Card className="mb-2">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Select value={ruleType} onValueChange={setRuleType}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="email_domain">Email Domain</SelectItem>
									<SelectItem value="school_id_prefix">
										School ID Prefix
									</SelectItem>
								</SelectContent>
							</Select>
							<Input
								placeholder="Rule value"
								value={ruleValue}
								onChange={(e) => setRuleValue(e.target.value)}
							/>
							<Button onClick={handleAdd} disabled={busy || !ruleValue.trim()}>
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
									<IconTrash className="size-4" />
								</Button>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
