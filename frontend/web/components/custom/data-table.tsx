"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	Table as TableRoot,
	TableRow,
} from "@/components/ui/table";

export function DataTable<T>({
	table,
	emptyMessage = "No results.",
}: {
	table: Table<T>;
	emptyMessage?: string;
}) {
	const colCount = table.getAllColumns().length;
	return (
		<div className="rounded-lg border">
			<TableRoot>
				<TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead
									key={h.id}
									className={h.column.id === "select" ? "w-8" : ""}
								>
									{h.isPlaceholder
										? null
										: flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={colCount}
								className="h-24 text-center text-muted-foreground"
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</TableRoot>
		</div>
	);
}
