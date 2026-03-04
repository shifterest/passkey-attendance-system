"use client";

import { RegistrationSessionDto } from "@/app/lib/api";
import { getRegistrationSession } from "@/app/lib/webauthn";
import { SearchForm } from "@/components/custom/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	type UniqueIdentifier,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconCircle,
	IconCircleCheckFilled,
	IconCircleXFilled,
	IconDotsVertical,
	IconFilter,
	IconLayoutColumns
} from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
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
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { RegistrationQrDialog } from "./registration-qr-dialog";

export const schema = z.object({
	id: z.string(),
	full_name: z.string(),
	role: z.string(),
	ongoing_class: z.string().nullable(),
	in_class: z.boolean(),
	school_id: z.string().nullable(),
	email: z.string(),
	records: z.number(),
	flagged: z.number(),
	enrollments: z.number(),
	registered: z.boolean(),
});

const ROLE_FILTER_VALUES = ["student", "teacher", "admin", "operator"] as const;
const REGISTERED_FILTER_VALUES = [true, false] as const;
const IN_CLASS_FILTER_VALUES = [true, false] as const;

const chartData = [
	{
		month: "January",
		desktop: 186,
		mobile: 80,
	},
	{
		month: "February",
		desktop: 305,
		mobile: 200,
	},
	{
		month: "March",
		desktop: 237,
		mobile: 120,
	},
	{
		month: "April",
		desktop: 73,
		mobile: 190,
	},
	{
		month: "May",
		desktop: 209,
		mobile: 130,
	},
	{
		month: "June",
		desktop: 214,
		mobile: 140,
	},
] as const;

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--primary)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

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

function columns(setRegistrationQrDialogState: (row: Row<z.infer<typeof schema>>) => void): ColumnDef<z.infer<typeof schema>>[] {
	return [
		{
			id: "select",
			header: ({ table }) => (
				<div className="flex items-center justify-center">
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						indeterminate={
							table.getIsSomePageRowsSelected() &&
							!table.getIsAllPageRowsSelected()
						}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
			header: "Full name",
			// cell: ({ row }) => {
			// 	return <TableCellViewer item={row.original} />;
			// },
			enableHiding: false,
		},
		{
			accessorKey: "role",
			filterFn: includesSomeFilter,
			header: "Role",
			cell: ({ row }) => (
				<div>
					<Badge
						variant="outline"
						className="text-muted-foreground px-1.5 capitalize"
					>
						{row.original.role}
					</Badge>
				</div>
			),
		},
		{
			accessorKey: "ongoing_class",
			header: "Ongoing class",
			cell: ({ row }) =>
				row.original.ongoing_class ? row.original.ongoing_class : "—",
		},
		{
			accessorKey: "in_class",
			filterFn: includesSomeFilter,
			header: "In class",
			cell: ({ row }) => (
				<div>
					<Badge variant="outline" className="text-muted-foreground px-1.5">
						{row.original.in_class ? (
							<IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
						) : row.original.ongoing_class ? (
							<IconCircleXFilled className="fill-red-500 dark:fill-red-400" />
						) : (
							<IconCircle className="fill-gray-500 dark:fill-gray-400" />
						)}
						{row.original.in_class
							? "In class"
							: row.original.ongoing_class
								? "Not in class"
								: "No ongoing class"}
					</Badge>
				</div>
			),
		},
		{
			accessorKey: "school_id",
			header: "School ID",
			cell: ({ row }) => row.original.school_id,
		},
		{
			accessorKey: "email",
			header: "Email",
			cell: ({ row }) => row.original.email,
		},
		{
			accessorKey: "records",
			header: "Records",
			cell: ({ row }) => row.original.records,
		},
		{
			accessorKey: "flagged",
			header: "Flagged",
			cell: ({ row }) => row.original.flagged,
		},
		{
			accessorKey: "enrollments",
			header: "Enrollments",
			cell: ({ row }) => row.original.enrollments,
		},
		{
			accessorKey: "registered",
			filterFn: includesSomeFilter,
			header: "Registration",
			cell: ({ row }) => (
				<Badge variant="outline" className="text-muted-foreground px-1.5">
					{row.original.registered ? (
						<IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
					) : (
						<IconCircleXFilled className="fill-red-500 dark:fill-red-400" />
					)}
					{row.original.registered ? "Registered" : "Unregistered"}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								className="data-open:bg-muted text-muted-foreground flex size-8"
								size="icon"
							/>
						}
					>
						<IconDotsVertical />
						<span className="sr-only">Open menu</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-64">
						{row.original.registered ? (
							<>
								<DropdownMenuItem onClick={async () => { setRegistrationQrDialogState(row); }}>
									Regenerate registration QR
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive">
									Unregister
								</DropdownMenuItem>
							</>
						) : (
							<DropdownMenuItem onClick={async () => { setRegistrationQrDialogState(row); }}>
								Generate registration QR
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	];
}

const getDefaultColumnFilters = (): ColumnFiltersState => {
	return [
		{ id: "role", value: [...ROLE_FILTER_VALUES] },
		{ id: "registered", value: [...REGISTERED_FILTER_VALUES] },
		{ id: "in_class", value: [...IN_CLASS_FILTER_VALUES] },
	];
}

const UserRow = ({ row }: { row: Row<z.infer<typeof schema>> }) => {
	const { transform, transition, setNodeRef } = useSortable({
		id: row.original.id,
	});
	return (
		<TableRow
			data-state={row.getIsSelected() && "selected"}
			ref={setNodeRef}
			className="relative z-0"
			style={{
				transform: CSS.Transform.toString(transform),
				transition: transition,
			}}
		>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id}>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	);
}

// function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
// 	const isMobile = useIsMobile();
// 	return (
// 		// TODO: Work on drawer content
// 		<Drawer direction={isMobile ? "bottom" : "right"}>
// 			<DrawerTrigger
// 				render={
// 					<Button
// 						variant="link"
// 						className="text-foreground w-fit px-0 text-left"
// 					/>
// 				}
// 			>
// 				{item.full_name}
// 			</DrawerTrigger>
// 			<DrawerContent>
// 				<DrawerHeader className="gap-1">
// 					<DrawerTitle>{item.full_name}</DrawerTitle>
// 					<DrawerDescription>
// 						Showing total attendance records in the last 3 months
// 					</DrawerDescription>
// 				</DrawerHeader>
// 				<div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
// 					{!isMobile && (
// 						<>
// 							<ChartContainer config={chartConfig}>
// 								<AreaChart
// 									accessibilityLayer
// 									data={chartData}
// 									margin={{
// 										left: 0,
// 										right: 10,
// 									}}
// 								>
// 									<CartesianGrid vertical={false} />
// 									<XAxis
// 										dataKey="month"
// 										tickLine={false}
// 										axisLine={false}
// 										tickMargin={8}
// 										tickFormatter={(value) => value.slice(0, 3)}
// 										hide
// 									/>
// 									<ChartTooltip
// 										cursor={false}
// 										content={<ChartTooltipContent indicator="dot" />}
// 									/>
// 									<Area
// 										dataKey="mobile"
// 										type="natural"
// 										fill="var(--color-mobile)"
// 										fillOpacity={0.6}
// 										stroke="var(--color-mobile)"
// 										stackId="a"
// 									/>
// 									<Area
// 										dataKey="desktop"
// 										type="natural"
// 										fill="var(--color-desktop)"
// 										fillOpacity={0.4}
// 										stroke="var(--color-desktop)"
// 										stackId="a"
// 									/>
// 								</AreaChart>
// 							</ChartContainer>
// 							<Separator />
// 							<div className="grid gap-2">
// 								<div className="flex gap-2 leading-none font-medium">
// 									Trending up by 5.2% this month{" "}
// 									<IconTrendingUp className="size-4" />
// 								</div>
// 								<div className="text-muted-foreground">
// 									Showing total visitors for the last 6 months. This is just
// 									some random text to test the layout. It spans multiple lines
// 									and should wrap around.
// 								</div>
// 							</div>
// 							<Separator />
// 						</>
// 					)}
// 					<form className="flex flex-col gap-4">
// 						<div className="flex flex-col gap-3">
// 							<Label htmlFor="header">Header</Label>
// 							<Input id="header" defaultValue={item.full_name} />
// 						</div>
// 						<div className="grid grid-cols-2 gap-4">
// 							<div className="flex flex-col gap-3">
// 								<Label htmlFor="type">Type</Label>
// 								<Select
// 									defaultValue={item.type}
// 									items={[
// 										{ label: "Table of Contents", value: "Table of Contents" },
// 										{ label: "Executive Summary", value: "Executive Summary" },
// 										{
// 											label: "Technical Approach",
// 											value: "Technical Approach",
// 										},
// 										{ label: "Design", value: "Design" },
// 										{ label: "Capabilities", value: "Capabilities" },
// 										{ label: "Focus Documents", value: "Focus Documents" },
// 										{ label: "Narrative", value: "Narrative" },
// 										{ label: "Cover Page", value: "Cover Page" },
// 									]}
// 								>
// 									<SelectTrigger id="type" className="w-full">
// 										<SelectValue placeholder="Select a type" />
// 									</SelectTrigger>
// 									<SelectContent>
// 										<SelectGroup>
// 											<SelectItem value="Table of Contents">
// 												Table of Contents
// 											</SelectItem>
// 											<SelectItem value="Executive Summary">
// 												Executive Summary
// 											</SelectItem>
// 											<SelectItem value="Technical Approach">
// 												Technical Approach
// 											</SelectItem>
// 											<SelectItem value="Design">Design</SelectItem>
// 											<SelectItem value="Capabilities">Capabilities</SelectItem>
// 											<SelectItem value="Focus Documents">
// 												Focus Documents
// 											</SelectItem>
// 											<SelectItem value="Narrative">Narrative</SelectItem>
// 											<SelectItem value="Cover Page">Cover Page</SelectItem>
// 										</SelectGroup>
// 									</SelectContent>
// 								</Select>
// 							</div>
// 							<div className="flex flex-col gap-3">
// 								<Label htmlFor="status">Status</Label>
// 								<Select
// 									defaultValue={item.status}
// 									items={[
// 										{ label: "Done", value: "Done" },
// 										{ label: "In Progress", value: "In Progress" },
// 										{ label: "Not Started", value: "Not Started" },
// 									]}
// 								>
// 									<SelectTrigger id="status" className="w-full">
// 										<SelectValue placeholder="Select a status" />
// 									</SelectTrigger>
// 									<SelectContent>
// 										<SelectGroup>
// 											<SelectItem value="Done">Done</SelectItem>
// 											<SelectItem value="In Progress">In Progress</SelectItem>
// 											<SelectItem value="Not Started">Not Started</SelectItem>
// 										</SelectGroup>
// 									</SelectContent>
// 								</Select>
// 							</div>
// 						</div>
// 						<div className="grid grid-cols-2 gap-4">
// 							<div className="flex flex-col gap-3">
// 								<Label htmlFor="target">Target</Label>
// 								<Input id="target" defaultValue={item.target} />
// 							</div>
// 							<div className="flex flex-col gap-3">
// 								<Label htmlFor="limit">Limit</Label>
// 								<Input id="limit" defaultValue={item.limit} />
// 							</div>
// 						</div>
// 						<div className="flex flex-col gap-3">
// 							<Label htmlFor="reviewer">Reviewer</Label>
// 							<Select
// 								defaultValue={item.reviewer}
// 								items={[
// 									{ label: "Eddie Lake", value: "Eddie Lake" },
// 									{ label: "Jamik Tashpulatov", value: "Jamik Tashpulatov" },
// 									{ label: "Emily Whalen", value: "Emily Whalen" },
// 								]}
// 							>
// 								<SelectTrigger id="reviewer" className="w-full">
// 									<SelectValue placeholder="Select a reviewer" />
// 								</SelectTrigger>
// 								<SelectContent>
// 									<SelectGroup>
// 										<SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
// 										<SelectItem value="Jamik Tashpulatov">
// 											Jamik Tashpulatov
// 										</SelectItem>
// 										<SelectItem value="Emily Whalen">Emily Whalen</SelectItem>
// 									</SelectGroup>
// 								</SelectContent>
// 							</Select>
// 						</div>
// 					</form>
// 				</div>
// 				<DrawerFooter>
// 					<Button>Submit</Button>
// 					<DrawerClose render={<Button variant="outline" />}></DrawerClose>
// 				</DrawerFooter>
// 			</DrawerContent>
// 		</Drawer>
// 	);
// }

export function DataTableStudent({
	data: initialData,
}: {
	data: z.infer<typeof schema>[];
}) {
	// Registration QR dialog
	const [open, setOpen] = useState(false);
	const [session, setSession] = useState<RegistrationSessionDto | null>(null);
	const [fullName, setFullName] = useState<string | undefined>(undefined);

	const [data, setData] = React.useState(() => initialData);
	const [rowSelection, setRowSelection] = React.useState({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		getDefaultColumnFilters,
	);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});

	const sortableId = React.useId();
	const sensors = useSensors(
		useSensor(MouseSensor, {}),
		useSensor(TouchSensor, {}),
		useSensor(KeyboardSensor, {}),
	);
	const dataIds = React.useMemo<UniqueIdentifier[]>(
		() => data?.map(({ id }) => id) || [],
		[data],
	);
	const [globalFilter, setGlobalFilter] = useState("");

	const setRegistrationQrDialogState = async (row: Row<z.infer<typeof schema>>) => {
		if (open) {
			setOpen(false);
			return;
		};
		setSession(await getRegistrationSession(row.original.id));
		setFullName(row.original.full_name);
		setOpen(true);
	}

	const table = useReactTable({
		data,
		columns: columns(setRegistrationQrDialogState),
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
				String(row.original.email).toLowerCase().includes(query)
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
	}

	const isFilterValueChecked = (columnId: string, value: string | boolean) => {
		const existingFilter = columnFilters.find(
			(filter) => filter.id === columnId,
		);
		const values = Array.isArray(existingFilter?.value)
			? (existingFilter.value as Array<string | boolean>)
			: [];

		return values.includes(value);
	}

	return (
		<Tabs
			defaultValue="outline"
			className="w-full flex-col justify-start gap-6"
		>
			<RegistrationQrDialog open={open} onOpenChange={setOpen} session={session} fullName={fullName} />
			<div className="flex items-center justify-between px-4 lg:px-6">
				<Label htmlFor="view-selector" className="sr-only">
					View
				</Label>
				<SearchForm onSearch={(query) => setGlobalFilter(query)} />
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconFilter data-icon="inline-start" />
							Filter
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Role</DropdownMenuLabel>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("role", "student")}
									onCheckedChange={(checked) => {
										toggleFilterValue("role", "student", checked);
									}}
								>
									Students
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("role", "teacher")}
									onCheckedChange={(checked) => {
										toggleFilterValue("role", "teacher", checked);
									}}
								>
									Teachers
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("role", "admin")}
									onCheckedChange={(checked) => {
										toggleFilterValue("role", "admin", checked);
									}}
								>
									Admins
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("role", "operator")}
									onCheckedChange={(checked) => {
										toggleFilterValue("role", "operator", checked);
									}}
								>
									Operators
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
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
								<DropdownMenuLabel>In class</DropdownMenuLabel>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("in_class", true)}
									onCheckedChange={(checked) => {
										toggleFilterValue("in_class", true, checked);
									}}
								>
									In class
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={isFilterValueChecked("in_class", false)}
									onCheckedChange={(checked) => {
										toggleFilterValue("in_class", false, checked);
									}}
								>
									Not in class
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => setColumnFilters(getDefaultColumnFilters())}
							>
								Reset filters
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							<IconLayoutColumns data-icon="inline-start" />
							Columns
							<IconChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-32">
							{table
								.getAllColumns()
								.filter(
									(column) =>
										typeof column.accessorFn !== "undefined" &&
										column.getCanHide(),
								)
								.map((column) => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											checked={column.getIsVisible()}
											onCheckedChange={(value) =>
												column.toggleVisibility(!!value)
											}
										>
											{column.id
												.replace(/_/g, " ")
												.replace(/\bid\b/g, "ID")
												.split(" ")
												.map((w) =>
													w === "ID"
														? w
														: w.charAt(0).toUpperCase() + w.slice(1),
												)
												.join(" ")}
										</DropdownMenuCheckboxItem>
									);
								})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<TabsContent
				value="outline"
				className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
			>
				<div className="overflow-hidden rounded-lg border">
					<DndContext
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						sensors={sensors}
						id={sortableId}
					>
						<Table>
							<TableHeader className="bg-muted sticky top-0 z-10">
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => {
											return (
												<TableHead key={header.id} colSpan={header.colSpan}>
													{header.isPlaceholder
														? null
														: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
												</TableHead>
											);
										})}
									</TableRow>
								))}
							</TableHeader>
							<TableBody className="**:data-[slot=table-cell]:first:w-8">
								{table.getRowModel().rows?.length ? (
									<SortableContext
										items={dataIds}
										strategy={verticalListSortingStrategy}
									>
										{table.getRowModel().rows.map((row) => (
											<UserRow key={row.id} row={row} />
										))}
									</SortableContext>
								) : (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
											No results.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</DndContext>
				</div>
				<div className="flex items-center justify-between px-4">
					<div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
						{table.getFilteredSelectedRowModel().rows.length} of{" "}
						{table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex w-full items-center gap-8 lg:w-fit">
						<div className="hidden items-center gap-2 lg:flex">
							<Label htmlFor="rows-per-page" className="text-sm font-medium">
								Rows per page
							</Label>
							<Select
								value={`${table.getState().pagination.pageSize}`}
								onValueChange={(value) => {
									table.setPageSize(Number(value));
								}}
								items={[10, 20, 30, 40, 50].map((pageSize) => ({
									label: `${pageSize}`,
									value: `${pageSize}`,
								}))}
							>
								<SelectTrigger size="sm" className="w-20" id="rows-per-page">
									<SelectValue
										placeholder={table.getState().pagination.pageSize}
									/>
								</SelectTrigger>
								<SelectContent side="top">
									<SelectGroup>
										{[10, 20, 30, 40, 50].map((pageSize) => (
											<SelectItem key={pageSize} value={`${pageSize}`}>
												{pageSize}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex w-fit items-center justify-center text-sm font-medium">
							Page {table.getState().pagination.pageIndex + 1} of{" "}
							{table.getPageCount()}
						</div>
						<div className="ml-auto flex items-center gap-2 lg:ml-0">
							<Button
								variant="outline"
								className="hidden h-8 w-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(0)}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to first page</span>
								<IconChevronsLeft />
							</Button>
							<Button
								variant="outline"
								className="size-8"
								size="icon"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to previous page</span>
								<IconChevronLeft />
							</Button>
							<Button
								variant="outline"
								className="size-8"
								size="icon"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to next page</span>
								<IconChevronRight />
							</Button>
							<Button
								variant="outline"
								className="hidden size-8 lg:flex"
								size="icon"
								onClick={() => table.setPageIndex(table.getPageCount() - 1)}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to last page</span>
								<IconChevronsRight />
							</Button>
						</div>
					</div>
				</div>
			</TabsContent>
		</Tabs>
	);
}


