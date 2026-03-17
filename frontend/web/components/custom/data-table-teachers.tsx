"use client";

import { IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { TeacherDto } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<TeacherDto>[] = [
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
		accessorKey: "class_count",
		header: "Classes",
		cell: ({ row }) => (
			<span className="text-sm">{row.original.class_count}</span>
		),
	},
	{
		accessorKey: "student_count",
		header: "Students",
		cell: ({ row }) => (
			<span className="text-sm">{row.original.student_count}</span>
		),
	},
	{
		accessorKey: "has_open_session",
		header: "Session",
		cell: ({ row }) =>
			row.original.has_open_session ? (
				<Badge variant="default" className="gap-1 text-xs">
					<IconCircleCheckFilled className="size-3 text-green-400" />
					Active
				</Badge>
			) : (
				<Badge variant="secondary" className="gap-1 text-xs">
					<IconCircle className="size-3" />
					Inactive
				</Badge>
			),
	},
];

export function DataTableTeachers({ data }: { data: TeacherDto[] }) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No teachers found." />
		</div>
	);
}
