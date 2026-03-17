"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { UserDto } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";

const ROLE_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	admin: "default",
	operator: "secondary",
	teacher: "outline",
	student: "outline",
};

const columns: ColumnDef<UserDto>[] = [
	{
		accessorKey: "full_name",
		header: "Name",
		cell: ({ row }) => (
			<span className="font-medium">{row.original.full_name}</span>
		),
	},
	{
		accessorKey: "email",
		header: "Email",
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.email}
			</span>
		),
	},
	{
		accessorKey: "school_id",
		header: "School ID",
		cell: ({ row }) => (
			<span className="font-mono text-sm">{row.original.school_id ?? "—"}</span>
		),
	},
	{
		accessorKey: "role",
		header: "Role",
		cell: ({ row }) => (
			<Badge variant={ROLE_VARIANTS[row.original.role] ?? "outline"}>
				{row.original.role}
			</Badge>
		),
	},
];

export function DataTableUsers({ data }: { data: UserDto[] }) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No users found." />
		</div>
	);
}
