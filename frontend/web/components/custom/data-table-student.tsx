"use client";

import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type Row,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import {
	getStudent,
	type RegistrationSessionDto,
	unregisterUser,
} from "@/app/lib/api";
import { getRegistrationSession } from "@/app/lib/webauthn";
import {
	DataTableBody,
	DataTableColumnVisibility,
	DataTableFilterMenu,
	DataTablePagination,
	DataTableRowActions,
	SortableHeader,
} from "@/components/custom/data-table-shared";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RegistrationQrDialog } from "./registration-qr-dialog";

export const schema = z.object({
	id: z.string(),
	full_name: z.string(),
	role: z.string(),
	ongoing_class: z.string().nullable(),
	in_class: z.boolean(),
	school_id: z.string().nullable(),
	program: z.string().nullable(),
	year_level: z.number().nullable(),
	enrollment_year: z.number().nullable(),
	email: z.string(),
	records: z.number(),
	flagged: z.number(),
	low_assurance: z.number(),
	enrollments: z.number(),
	registered: z.boolean(),
});

const REGISTERED_FILTER_VALUES = [true, false] as const;
const IN_CLASS_FILTER_VALUES = [true, false] as const;

const includesSomeFilter: FilterFn<z.infer<typeof schema>> = (
	row,
	columnId,
	filterValue,
) => {
	if (!Array.isArray(filterValue)) {
		return true;
	}

	const cellValue = row.getValue(columnId);
	return filterValue.includes(cellValue);
};

function columns(
	setRegistrationQrDialogState: (row: Row<z.infer<typeof schema>>) => void,
	onUnregister: (userId: string) => Promise<void>,
): ColumnDef<z.infer<typeof schema>>[] {
	return [
		{
			id: "select",
			header: ({ table }) => (
				<div className="flex w-8 items-center justify-center">
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						indeterminate={
							table.getIsSomePageRowsSelected() &&
							!table.getIsAllPageRowsSelected()
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
					/>
				</div>
			),
			cell: ({ row }) => (
				<div className="w-8 flex items-center justify-center">
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
					/>
				</div>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "full_name",
			header: ({ column }) => (
				<SortableHeader column={column} label="Full name" />
			),
			enableHiding: false,
		},
		{
			accessorKey: "school_id",
			header: ({ column }) => (
				<SortableHeader column={column} label="School ID" />
			),
			cell: ({ row }) => (
				<span className="font-mono text-sm">
					{row.original.school_id ?? "—"}
				</span>
			),
		},
		{
			accessorKey: "program",
			header: "Program",
			cell: ({ row }) => row.original.program ?? "—",
		},
		{
			accessorKey: "enrollment_year",
			header: ({ column }) => (
				<SortableHeader column={column} label="Enrollment Year" />
			),
			cell: ({ row }) => row.original.enrollment_year ?? "—",
		},
		{
			accessorKey: "year_level",
			header: ({ column }) => (
				<SortableHeader column={column} label="Year Level" />
			),
			cell: ({ row }) => row.original.year_level ?? "—",
		},
		{
			accessorKey: "registered",
			filterFn: includesSomeFilter,
			header: "Registration",
			cell: ({ row }) =>
				row.original.registered ? (
					<Badge className="border-green-200 bg-green-50 px-1.5 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
						<IconCircleCheckFilled />
						Registered
					</Badge>
				) : (
					<button
						type="button"
						className="cursor-pointer"
						onClick={() => setRegistrationQrDialogState(row)}
						tabIndex={0}
					>
						<Badge className="border-red-200 bg-red-50 px-1.5 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							<IconCircleXFilled />
							Unregistered
						</Badge>
					</button>
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
			accessorKey: "ongoing_class",
			header: "Session",
			cell: ({ row }) =>
				row.original.ongoing_class ? (
					<Badge className="border-blue-200 bg-blue-50 px-1.5 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
						<IconCircleCheckFilled />
						{row.original.ongoing_class}
					</Badge>
				) : (
					"—"
				),
		},
		{
			accessorKey: "in_class",
			filterFn: includesSomeFilter,
			header: "Checked in",
			cell: ({ row }) => {
				if (!row.original.ongoing_class) return "—";
				return row.original.in_class ? (
					<Badge className="border-green-200 bg-green-50 px-1.5 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
						<IconCircleCheckFilled />
						Checked in
					</Badge>
				) : (
					<Badge className="border-red-200 bg-red-50 px-1.5 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
						<IconCircleXFilled />
						Not checked in
					</Badge>
				);
			},
		},
		{
			accessorKey: "records",
			header: ({ column }) => (
				<SortableHeader column={column} label="Records" />
			),
			cell: ({ row }) => row.original.records,
		},
		{
			accessorKey: "flagged",
			header: ({ column }) => (
				<SortableHeader column={column} label="Flagged" />
			),
			cell: ({ row }) => row.original.flagged,
		},
		{
			accessorKey: "low_assurance",
			header: ({ column }) => (
				<SortableHeader column={column} label="Low Assurance" />
			),
			cell: ({ row }) => row.original.low_assurance,
		},
		{
			accessorKey: "enrollments",
			header: ({ column }) => (
				<SortableHeader column={column} label="Enrollments" />
			),
			cell: ({ row }) => row.original.enrollments,
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DataTableRowActions contentClassName="w-64">
					{row.original.registered ? (
						<>
							<DropdownMenuItem
								onClick={async () => {
									setRegistrationQrDialogState(row);
								}}
							>
								Regenerate registration QR
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={async () => {
									await onUnregister(row.original.id);
								}}
								variant="destructive"
							>
								Unregister
							</DropdownMenuItem>
						</>
					) : (
						<DropdownMenuItem
							onClick={async () => {
								setRegistrationQrDialogState(row);
							}}
						>
							Generate registration QR
						</DropdownMenuItem>
					)}
				</DataTableRowActions>
			),
		},
	];
}

const getDefaultColumnFilters = (): ColumnFiltersState => {
	return [
		{ id: "registered", value: [...REGISTERED_FILTER_VALUES] },
		{ id: "in_class", value: [...IN_CLASS_FILTER_VALUES] },
	];
};
export function DataTableStudent({
	data: initialData,
}: {
	data: z.infer<typeof schema>[];
}) {
	const router = useRouter();

	// Registration QR dialog
	const [open, setOpen] = useState(false);
	const [session, setSession] = useState<RegistrationSessionDto | null>(null);
	const [fullName, setFullName] = useState<string | undefined>(undefined);
	const [registrationUserId, setRegistrationUserId] = useState<string | null>(
		null,
	);

	const data = initialData;
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({
			email: false,
			year_level: false,
			low_assurance: false,
		});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		getDefaultColumnFilters,
	);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});

	const [globalFilter, setGlobalFilter] = useState("");
	const [yearFilter, setYearFilter] = React.useState<number[]>([]);
	const [programFilter, setProgramFilter] = React.useState<string[]>([]);
	const [isBulkUnregistering, setIsBulkUnregistering] = React.useState(false);

	const yearOptions = React.useMemo(
		() =>
			[
				...new Set(
					data
						.map((r) => r.enrollment_year)
						.filter((y): y is number => y !== null),
				),
			].sort((a, b) => a - b),
		[data],
	);

	const programOptions = React.useMemo(
		() =>
			[
				...new Set(
					data.map((r) => r.program).filter((p): p is string => p !== null),
				),
			].sort(),
		[data],
	);

	const filteredData = React.useMemo(
		() =>
			data.filter((r) => {
				if (
					yearFilter.length > 0 &&
					(r.enrollment_year === null ||
						!yearFilter.includes(r.enrollment_year))
				)
					return false;
				if (
					programFilter.length > 0 &&
					(r.program === null || !programFilter.includes(r.program))
				)
					return false;
				return true;
			}),
		[data, yearFilter, programFilter],
	);

	const toggleYearFilter = (year: number, checked: boolean) => {
		setYearFilter((prev) => {
			if (checked) return [...new Set([...prev, year])];
			if (prev.length === 1 && prev.includes(year)) return prev;
			return prev.filter((y) => y !== year);
		});
	};

	const toggleProgramFilter = (program: string, checked: boolean) => {
		setProgramFilter((prev) => {
			if (checked) return [...new Set([...prev, program])];
			if (prev.length === 1 && prev.includes(program)) return prev;
			return prev.filter((p) => p !== program);
		});
	};

	const closeRegistrationQrDialog = React.useCallback(() => {
		setOpen(false);
		setSession(null);
		setFullName(undefined);
		setRegistrationUserId(null);
	}, []);

	const setRegistrationQrDialogState = async (
		row: Row<z.infer<typeof schema>>,
	) => {
		if (open) {
			closeRegistrationQrDialog();
			return;
		}
		setSession(await getRegistrationSession(row.original.id));
		setFullName(row.original.full_name);
		setRegistrationUserId(row.original.id);
		setOpen(true);
	};

	const setRegistrationQrDialogOpenState = React.useCallback(
		(nextOpen: boolean) => {
			if (nextOpen) {
				setOpen(true);
				return;
			}

			closeRegistrationQrDialog();
		},
		[closeRegistrationQrDialog],
	);

	React.useEffect(() => {
		if (!open || registrationUserId === null) {
			return;
		}

		const intervalId = window.setInterval(async () => {
			try {
				const latestUser = await getStudent(registrationUserId);
				if (!latestUser.registered) {
					return;
				}

				setRegistrationQrDialogOpenState(false);
				router.refresh();
			} catch {
				return;
			}
		}, 2000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [open, registrationUserId, router, setRegistrationQrDialogOpenState]);

	const handleUnregisterUsers = React.useCallback(
		async (userIds: string[]) => {
			if (userIds.length === 0) {
				return;
			}

			setIsBulkUnregistering(true);

			try {
				await Promise.all(userIds.map((userId) => unregisterUser(userId)));
				setRowSelection({});
				router.refresh();
			} finally {
				setIsBulkUnregistering(false);
			}
		},
		[router],
	);

	const handleUnregister = React.useCallback(
		async (userId: string) => {
			await handleUnregisterUsers([userId]);
		},
		[handleUnregisterUsers],
	);

	const table = useReactTable({
		data: filteredData,
		columns: columns(setRegistrationQrDialogState, handleUnregister),
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			columnFilters,
			pagination,
			globalFilter,
		},
		globalFilterFn: (row) => {
			const query = globalFilter.toLowerCase();
			return (
				String(row.original.full_name).toLowerCase().includes(query) ||
				String(row.original.school_id).toLowerCase().includes(query) ||
				String(row.original.email).toLowerCase().includes(query) ||
				String(row.original.program ?? "")
					.toLowerCase()
					.includes(query)
			);
		},
		getRowId: (row) => row.id.toString(),
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	// Vibecoded so we'll learn about this later
	const toggleFilterValue = (
		columnId: string,
		value: string | boolean,
		checked: boolean,
	) => {
		setColumnFilters((previousFilters) => {
			const existingFilter = previousFilters.find(
				(filter) => filter.id === columnId,
			);
			const existingValues = Array.isArray(existingFilter?.value)
				? (existingFilter.value as Array<string | boolean>)
				: [];

			if (
				!checked &&
				existingValues.includes(value) &&
				existingValues.length === 1
			) {
				return previousFilters;
			}

			const nextValues = checked
				? Array.from(new Set([...existingValues, value]))
				: existingValues.filter((item) => item !== value);

			const otherFilters = previousFilters.filter(
				(filter) => filter.id !== columnId,
			);

			return [...otherFilters, { id: columnId, value: nextValues }];
		});
	};

	const isFilterValueChecked = (columnId: string, value: string | boolean) => {
		const existingFilter = columnFilters.find(
			(filter) => filter.id === columnId,
		);
		const values = Array.isArray(existingFilter?.value)
			? (existingFilter.value as Array<string | boolean>)
			: [];

		return values.includes(value);
	};

	const selectedRegisteredStudents = table
		.getFilteredSelectedRowModel()
		.rows.map((row) => row.original)
		.filter((student) => student.registered);

	return (
		<div className="flex w-full flex-col justify-start gap-6">
			<RegistrationQrDialog
				open={open}
				onOpenChange={setRegistrationQrDialogOpenState}
				session={session}
				fullName={fullName}
				onExpired={
					registrationUserId
						? async () => {
								const newSession =
									await getRegistrationSession(registrationUserId);
								setSession(newSession);
							}
						: undefined
				}
			/>
			<div className="flex items-center justify-between px-4 lg:px-6">
				<Label htmlFor="view-selector" className="sr-only">
					View
				</Label>
				<SearchForm onSearch={(query) => setGlobalFilter(query)} />
				<div className="flex items-center gap-2">
					<DataTableFilterMenu>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Registration</DropdownMenuLabel>
							<DropdownMenuCheckboxItem
								checked={isFilterValueChecked("registered", true)}
								onCheckedChange={(checked) => {
									toggleFilterValue("registered", true, checked);
								}}
							>
								Registered
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={isFilterValueChecked("registered", false)}
								onCheckedChange={(checked) => {
									toggleFilterValue("registered", false, checked);
								}}
							>
								Unregistered
							</DropdownMenuCheckboxItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Checked in</DropdownMenuLabel>
							<DropdownMenuCheckboxItem
								checked={isFilterValueChecked("in_class", true)}
								onCheckedChange={(checked) => {
									toggleFilterValue("in_class", true, checked);
								}}
							>
								Checked in
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={isFilterValueChecked("in_class", false)}
								onCheckedChange={(checked) => {
									toggleFilterValue("in_class", false, checked);
								}}
							>
								Not checked in
							</DropdownMenuCheckboxItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Program</DropdownMenuLabel>
							{programOptions.map((program) => (
								<DropdownMenuCheckboxItem
									key={program}
									checked={programFilter.includes(program)}
									onCheckedChange={(checked) =>
										toggleProgramFilter(program, checked)
									}
								>
									{program}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Enrollment Year</DropdownMenuLabel>
							{yearOptions.map((year) => (
								<DropdownMenuCheckboxItem
									key={year}
									checked={yearFilter.includes(year)}
									onCheckedChange={(checked) => toggleYearFilter(year, checked)}
								>
									{year}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								setColumnFilters(getDefaultColumnFilters());
								setYearFilter([]);
								setProgramFilter([]);
							}}
						>
							Reset filters
						</DropdownMenuItem>
					</DataTableFilterMenu>
					<DataTableColumnVisibility table={table} width="w-32" />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<DataTableBody
					table={table}
					columnCount={
						columns(setRegistrationQrDialogState, handleUnregister).length
					}
				/>
				<DataTablePagination
					table={table}
					pageSizeOptions={[10, 20, 30, 40, 50]}
					selectionActions={
						selectedRegisteredStudents.length > 0 ? (
							<Button
								variant="outline"
								size="sm"
								disabled={isBulkUnregistering}
								onClick={() =>
									void handleUnregisterUsers(
										selectedRegisteredStudents.map((student) => student.id),
									)
								}
							>
								{isBulkUnregistering
									? "Unregistering..."
									: `Unregister ${selectedRegisteredStudents.length} registered`}
							</Button>
						) : null
					}
				/>
			</div>
		</div>
	);
}
