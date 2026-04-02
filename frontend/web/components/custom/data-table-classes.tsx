"use client";

import { IconCalendar, IconDotsVertical } from "@tabler/icons-react";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ClassDto } from "@/app/lib/api";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatSchedule(schedule: ClassDto["schedule"]) {
	return schedule
		.map((s) => `${s.days.join(", ")} ${s.start_time}–${s.end_time}`)
		.join("; ");
}

export function DataTableClasses({ data }: { data: ClassDto[] }) {
	const router = useRouter();

	const columns = React.useMemo<ColumnDef<ClassDto>[]>(
		() => [
			{
				accessorKey: "course_code",
				header: "Code",
				cell: ({ row }) => (
					<Badge variant="outline" className="font-mono">
						{row.original.course_code}
					</Badge>
				),
			},
			{
				accessorKey: "course_name",
				header: "Course name",
				cell: ({ row }) => (
					<span className="font-medium">{row.original.course_name}</span>
				),
			},
			{
				accessorKey: "schedule",
				header: "Schedule",
				cell: ({ row }) => (
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<IconCalendar className="size-4 shrink-0" />
						{formatSchedule(row.original.schedule)}
					</div>
				),
			},
			{
				id: "thresholds",
				header: "Thresholds",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						Standard ≥{row.original.standard_assurance_threshold} · High ≥
						{row.original.high_assurance_threshold}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="ghost" size="icon" className="size-8" />}
						>
							<IconDotsVertical />
							<span className="sr-only">Open menu</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuItem
									onClick={() =>
										router.push(`/classes/${row.original.id}/sessions`)
									}
								>
									Sessions
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										router.push(`/enrollments?class_id=${row.original.id}`)
									}
								>
									Manage enrollment
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				),
			},
		],
		[router],
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="px-4 lg:px-6">
			<DataTable table={table} emptyMessage="No classes found." />
		</div>
	);
}
