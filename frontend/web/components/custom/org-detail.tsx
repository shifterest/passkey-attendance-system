"use client";

import { IconChevronRight, IconPlus, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventDto, OrgMemberDto, OrgRuleDto } from "@/app/lib/api";
import {
	createEvent,
	createOrgRule,
	deleteEvent,
	deleteOrgRule,
	grantMembership,
	revokeMembership,
} from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const ORG_MEMBERSHIP_TYPE_OPTIONS = [
	{ value: "explicit_grant", label: "Explicit Grant" },
	{ value: "role_elevation", label: "Role Elevation" },
] as const;

const ORG_ROLE_OPTIONS = [
	{ value: "member", label: "Member" },
	{ value: "moderator", label: "Moderator" },
	{ value: "event_creator", label: "Event Creator" },
	{ value: "admin", label: "Admin" },
] as const;

const ORG_RULE_OPTIONS = [
	{ value: "all", label: "All Users" },
	{ value: "role", label: "User Role" },
	{ value: "program", label: "Program" },
	{ value: "year_level", label: "Year Level" },
] as const;

type OrgMembershipType = (typeof ORG_MEMBERSHIP_TYPE_OPTIONS)[number]["value"];
type OrgRole = (typeof ORG_ROLE_OPTIONS)[number]["value"];
type OrgRuleType = (typeof ORG_RULE_OPTIONS)[number]["value"];

export function OrgDetail({
	orgId,
	members,
	rules,
	events,
}: {
	orgId: string;
	members: OrgMemberDto[];
	rules: OrgRuleDto[];
	events: EventDto[];
}) {
	return (
		<div className="px-4 lg:px-6 flex flex-col gap-6">
			<MembersSection orgId={orgId} members={members} />
			<RulesSection orgId={orgId} rules={rules} />
			<EventsSection orgId={orgId} events={events} />
		</div>
	);
}

function MembersSection({
	orgId,
	members,
}: {
	orgId: string;
	members: OrgMemberDto[];
}) {
	const router = useRouter();
	const [showAdd, setShowAdd] = useState(false);
	const [userId, setUserId] = useState("");
	const [membershipType, setMembershipType] =
		useState<OrgMembershipType>("explicit_grant");
	const [orgRole, setOrgRole] = useState<OrgRole>("member");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleAdd() {
		if (!userId.trim() || busy) return;
		setBusy(true);
		setError(null);
		try {
			await grantMembership(orgId, {
				user_id: userId.trim(),
				membership_type: membershipType,
				org_role: orgRole,
			});
			setUserId("");
			setShowAdd(false);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add member");
		} finally {
			setBusy(false);
		}
	}

	async function handleRevoke(uid: string) {
		try {
			await revokeMembership(orgId, uid);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to revoke member");
		}
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-lg font-semibold">Members</h3>
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
				<Card className="mb-3">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Input
								placeholder="User ID"
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
							/>
							<div className="flex gap-2">
								<Select
									value={membershipType}
									onValueChange={(value) => {
										if (value) {
											setMembershipType(value as OrgMembershipType);
										}
									}}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ORG_MEMBERSHIP_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={orgRole}
									onValueChange={(value) => {
										if (value) {
											setOrgRole(value as OrgRole);
										}
									}}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ORG_ROLE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{error && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</div>
							)}
							<Button onClick={handleAdd} disabled={busy || !userId.trim()}>
								{busy ? "Adding..." : "Add Member"}
							</Button>
						</div>
					</CardHeader>
				</Card>
			)}

			{members.length === 0 ? (
				<p className="text-muted-foreground text-sm">No members.</p>
			) : (
				<div className="grid gap-2">
					{members.map((m) => (
						<Card key={m.id}>
							<CardHeader className="flex-row items-center justify-between py-3">
								<div className="flex items-center gap-2">
									<span className="font-mono text-sm">{m.user_id}</span>
									<Badge variant="outline">{m.org_role ?? "member"}</Badge>
									<Badge variant="secondary">{m.membership_type}</Badge>
									{m.membership_type === "explicit_revocation" && (
										<Badge variant="destructive">revoked</Badge>
									)}
								</div>
								{m.membership_type !== "explicit_revocation" && (
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleRevoke(m.user_id)}
									>
										<IconTrash />
									</Button>
								)}
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function RulesSection({
	orgId,
	rules,
}: {
	orgId: string;
	rules: OrgRuleDto[];
}) {
	const router = useRouter();
	const [showAdd, setShowAdd] = useState(false);
	const [ruleType, setRuleType] = useState<OrgRuleType>("all");
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
			await createOrgRule(orgId, {
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
			await deleteOrgRule(orgId, ruleId);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to delete rule");
		}
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-lg font-semibold">Membership Rules</h3>
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
				<Card className="mb-3">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Select
								value={ruleType}
								onValueChange={(value) => {
									if (value) {
										setRuleType(value as OrgRuleType);
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
									{ORG_RULE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{requiresRuleValue && (
								<Input
									placeholder="Rule value"
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
				<p className="text-muted-foreground text-sm">No rules.</p>
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

function EventsSection({
	orgId,
	events,
}: {
	orgId: string;
	events: EventDto[];
}) {
	const router = useRouter();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleCreate() {
		if (!name.trim() || busy) return;
		setBusy(true);
		setError(null);
		try {
			await createEvent(orgId, {
				name: name.trim(),
				description: description.trim() || undefined,
			});
			setName("");
			setDescription("");
			setShowCreate(false);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create event");
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete(eventId: string) {
		try {
			await deleteEvent(eventId);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to delete event");
		}
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-lg font-semibold">Events</h3>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowCreate(!showCreate)}
				>
					<IconPlus data-icon="inline-start" />
					New
				</Button>
			</div>

			{showCreate && (
				<Card className="mb-3">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Input
								placeholder="Event name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<Input
								placeholder="Description (optional)"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
							{error && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</div>
							)}
							<Button onClick={handleCreate} disabled={busy || !name.trim()}>
								{busy ? "Creating..." : "Create Event"}
							</Button>
						</div>
					</CardHeader>
				</Card>
			)}

			{events.length === 0 ? (
				<p className="text-muted-foreground text-sm">No events.</p>
			) : (
				<div className="grid gap-2">
					{events.map((ev) => (
						<Card key={ev.id}>
							<CardHeader className="flex-row items-center justify-between">
								<div>
									<CardTitle>
										<Link
											href={`/orgs/${orgId}/events/${ev.id}`}
											className="hover:underline"
										>
											{ev.name}
										</Link>
									</CardTitle>
									{ev.description && (
										<CardDescription>{ev.description}</CardDescription>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDelete(ev.id)}
									>
										<IconTrash />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										render={<Link href={`/orgs/${orgId}/events/${ev.id}`} />}
									>
										<IconChevronRight />
									</Button>
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
