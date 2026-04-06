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
	const [membershipType, setMembershipType] = useState("explicit");
	const [orgRole, setOrgRole] = useState("member");
	const [busy, setBusy] = useState(false);

	async function handleAdd() {
		if (!userId.trim() || busy) return;
		setBusy(true);
		try {
			await grantMembership(orgId, {
				user_id: userId.trim(),
				membership_type: membershipType,
				org_role: orgRole,
			});
			setUserId("");
			setShowAdd(false);
			router.refresh();
		} finally {
			setBusy(false);
		}
	}

	async function handleRevoke(uid: string) {
		await revokeMembership(orgId, uid);
		router.refresh();
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
									onValueChange={setMembershipType}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="explicit">Explicit</SelectItem>
										<SelectItem value="rule">Rule</SelectItem>
									</SelectContent>
								</Select>
								<Select value={orgRole} onValueChange={setOrgRole}>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="member">Member</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
							</div>
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
									<Badge variant="outline">{m.org_role}</Badge>
									<Badge variant="secondary">{m.membership_type}</Badge>
									{m.is_revoked && <Badge variant="destructive">revoked</Badge>}
								</div>
								{!m.is_revoked && (
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleRevoke(m.user_id)}
									>
										<IconTrash className="size-4" />
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
	const [ruleType, setRuleType] = useState("email_domain");
	const [ruleValue, setRuleValue] = useState("");
	const [busy, setBusy] = useState(false);

	async function handleAdd() {
		if (!ruleValue.trim() || busy) return;
		setBusy(true);
		try {
			await createOrgRule(orgId, {
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
		await deleteOrgRule(orgId, ruleId);
		router.refresh();
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
					<IconPlus className="mr-1 size-4" />
					Add
				</Button>
			</div>

			{showAdd && (
				<Card className="mb-3">
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

	async function handleCreate() {
		if (!name.trim() || busy) return;
		setBusy(true);
		try {
			await createEvent(orgId, {
				name: name.trim(),
				description: description.trim() || undefined,
			});
			setName("");
			setDescription("");
			setShowCreate(false);
			router.refresh();
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete(eventId: string) {
		await deleteEvent(eventId);
		router.refresh();
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
					<IconPlus className="mr-1 size-4" />
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
										<IconTrash className="size-4" />
									</Button>
									<Link href={`/orgs/${orgId}/events/${ev.id}`}>
										<IconChevronRight className="size-4 text-muted-foreground" />
									</Link>
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
