"use client";

import { IconChevronRight, IconPlus, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrgDto } from "@/app/lib/api";
import { createOrg, deleteOrg } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function OrgList({ data }: { data: OrgDto[] }) {
	const router = useRouter();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [creating, setCreating] = useState(false);

	async function handleCreate() {
		if (!name.trim() || creating) return;
		setCreating(true);
		try {
			await createOrg({
				name: name.trim(),
				description: description.trim() || undefined,
			});
			setName("");
			setDescription("");
			setShowCreate(false);
			router.refresh();
		} finally {
			setCreating(false);
		}
	}

	async function handleDelete(orgId: string) {
		await deleteOrg(orgId);
		router.refresh();
	}

	return (
		<div className="px-4 lg:px-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl font-semibold">Organizations</h2>
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
				<Card className="mb-4">
					<CardHeader>
						<div className="flex flex-col gap-2">
							<Input
								placeholder="Organization name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<Input
								placeholder="Description (optional)"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
							<Button
								onClick={handleCreate}
								disabled={creating || !name.trim()}
							>
								{creating ? "Creating..." : "Create"}
							</Button>
						</div>
					</CardHeader>
				</Card>
			)}

			{data.length === 0 ? (
				<p className="text-muted-foreground text-sm">No organizations yet.</p>
			) : (
				<div className="grid gap-2">
					{data.map((org) => (
						<Card key={org.id}>
							<CardHeader className="flex-row items-center justify-between">
								<div>
									<CardTitle>
										<Link href={`/orgs/${org.id}`} className="hover:underline">
											{org.name}
										</Link>
									</CardTitle>
									{org.description && (
										<CardDescription>{org.description}</CardDescription>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDelete(org.id)}
									>
										<IconTrash className="size-4" />
									</Button>
									<Link href={`/orgs/${org.id}`}>
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
