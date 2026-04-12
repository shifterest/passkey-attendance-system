"use client";

import {
	IconChalkboardTeacher,
	IconCircleCheckFilled,
	IconCircleXFilled,
	IconTool,
	IconUser,
	IconUserEdit,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ComponentType } from "react";
import { SortableHeader } from "@/components/custom/data-table-shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function formatTableDateTime(value: string) {
	return new Date(value).toLocaleString();
}

export function formatTableDate(value: string) {
	return new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function DatabaseIdCell({
	value,
	className,
}: {
	value: string | null | undefined;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"font-mono text-xs break-all",
				!value && "text-muted-foreground",
				className,
			)}
		>
			{value ?? "—"}
		</span>
	);
}

export function createDatabaseIdColumn<
	TData extends { id: string },
>(): ColumnDef<TData> {
	return {
		accessorKey: "id",
		header: ({ column }) => <SortableHeader column={column} label="ID" />,
		cell: ({ row }) => <DatabaseIdCell value={row.original.id} />,
	};
}

export function RegistrationStatusBadge({
	registered,
	onUnregisteredClick,
}: {
	registered: boolean;
	onUnregisteredClick?: () => void;
}) {
	const badge = registered ? (
		<Badge className="border-green-200 bg-green-50 px-1.5 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
			<IconCircleCheckFilled />
			Registered
		</Badge>
	) : (
		<Badge className="border-red-200 bg-red-50 px-1.5 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
			<IconCircleXFilled />
			Unregistered
		</Badge>
	);

	if (!registered && onUnregisteredClick) {
		return (
			<button
				type="button"
				className="cursor-pointer"
				onClick={onUnregisteredClick}
				tabIndex={0}
			>
				{badge}
			</button>
		);
	}

	return badge;
}

type RoleMeta = {
	label: string;
	icon: ComponentType;
	className: string;
};

const ROLE_META: Record<string, RoleMeta> = {
	student: {
		label: "Student",
		icon: IconUserEdit,
		className:
			"border-blue-200 bg-blue-50 px-1.5 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
	},
	teacher: {
		label: "Teacher",
		icon: IconChalkboardTeacher,
		className:
			"border-emerald-200 bg-emerald-50 px-1.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
	},
	admin: {
		label: "Admin",
		icon: IconTool,
		className:
			"border-amber-200 bg-amber-50 px-1.5 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
	},
	operator: {
		label: "Operator",
		icon: IconTool,
		className:
			"border-slate-200 bg-slate-50 px-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-300",
	},
};

export function getRoleMeta(role: string): RoleMeta {
	return (
		ROLE_META[role.toLowerCase()] ?? {
			label: role,
			icon: IconUser,
			className: "",
		}
	);
}

export function UserRoleBadge({ role }: { role: string }) {
	const meta = getRoleMeta(role);
	const Icon = meta.icon;

	if (!ROLE_META[role.toLowerCase()]) {
		return (
			<Badge variant="outline" className="px-1.5 capitalize">
				<Icon />
				{meta.label}
			</Badge>
		);
	}

	return (
		<Badge className={meta.className}>
			<Icon />
			{meta.label}
		</Badge>
	);
}

export function ThresholdDisplay({
	standard,
	high,
}: {
	standard: number;
	high: number;
}) {
	return (
		<span className="text-xs text-muted-foreground">
			Standard ≥{standard} · High ≥{high}
		</span>
	);
}
