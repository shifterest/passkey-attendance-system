"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

export const description = "An interactive area chart";

const chartData = [
	{ date: "2024-04-01", records: 222, flagged: 150 },
	{ date: "2024-04-02", records: 97, flagged: 180 },
	{ date: "2024-04-03", records: 167, flagged: 120 },
	{ date: "2024-04-04", records: 242, flagged: 260 },
	{ date: "2024-04-05", records: 373, flagged: 290 },
	{ date: "2024-04-06", records: 301, flagged: 340 },
	{ date: "2024-04-07", records: 245, flagged: 180 },
	{ date: "2024-04-08", records: 409, flagged: 320 },
	{ date: "2024-04-09", records: 59, flagged: 110 },
	{ date: "2024-04-10", records: 261, flagged: 190 },
	{ date: "2024-04-11", records: 327, flagged: 350 },
	{ date: "2024-04-12", records: 292, flagged: 210 },
	{ date: "2024-04-13", records: 342, flagged: 380 },
	{ date: "2024-04-14", records: 137, flagged: 220 },
	{ date: "2024-04-15", records: 120, flagged: 170 },
	{ date: "2024-04-16", records: 138, flagged: 190 },
	{ date: "2024-04-17", records: 446, flagged: 360 },
	{ date: "2024-04-18", records: 364, flagged: 410 },
	{ date: "2024-04-19", records: 243, flagged: 180 },
	{ date: "2024-04-20", records: 89, flagged: 150 },
	{ date: "2024-04-21", records: 137, flagged: 200 },
	{ date: "2024-04-22", records: 224, flagged: 170 },
	{ date: "2024-04-23", records: 138, flagged: 230 },
	{ date: "2024-04-24", records: 387, flagged: 290 },
	{ date: "2024-04-25", records: 215, flagged: 250 },
	{ date: "2024-04-26", records: 75, flagged: 130 },
	{ date: "2024-04-27", records: 383, flagged: 420 },
	{ date: "2024-04-28", records: 122, flagged: 180 },
	{ date: "2024-04-29", records: 315, flagged: 240 },
	{ date: "2024-04-30", records: 454, flagged: 380 },
	{ date: "2024-05-01", records: 165, flagged: 220 },
	{ date: "2024-05-02", records: 293, flagged: 310 },
	{ date: "2024-05-03", records: 247, flagged: 190 },
	{ date: "2024-05-04", records: 385, flagged: 420 },
	{ date: "2024-05-05", records: 481, flagged: 390 },
	{ date: "2024-05-06", records: 498, flagged: 520 },
	{ date: "2024-05-07", records: 388, flagged: 300 },
	{ date: "2024-05-08", records: 149, flagged: 210 },
	{ date: "2024-05-09", records: 227, flagged: 180 },
	{ date: "2024-05-10", records: 293, flagged: 330 },
	{ date: "2024-05-11", records: 335, flagged: 270 },
	{ date: "2024-05-12", records: 197, flagged: 240 },
	{ date: "2024-05-13", records: 197, flagged: 160 },
	{ date: "2024-05-14", records: 448, flagged: 490 },
	{ date: "2024-05-15", records: 473, flagged: 380 },
	{ date: "2024-05-16", records: 338, flagged: 400 },
	{ date: "2024-05-17", records: 499, flagged: 420 },
	{ date: "2024-05-18", records: 315, flagged: 350 },
	{ date: "2024-05-19", records: 235, flagged: 180 },
	{ date: "2024-05-20", records: 177, flagged: 230 },
	{ date: "2024-05-21", records: 82, flagged: 140 },
	{ date: "2024-05-22", records: 81, flagged: 120 },
	{ date: "2024-05-23", records: 252, flagged: 290 },
	{ date: "2024-05-24", records: 294, flagged: 220 },
	{ date: "2024-05-25", records: 201, flagged: 250 },
	{ date: "2024-05-26", records: 213, flagged: 170 },
	{ date: "2024-05-27", records: 420, flagged: 460 },
	{ date: "2024-05-28", records: 233, flagged: 190 },
	{ date: "2024-05-29", records: 78, flagged: 130 },
	{ date: "2024-05-30", records: 340, flagged: 280 },
	{ date: "2024-05-31", records: 178, flagged: 230 },
	{ date: "2024-06-01", records: 178, flagged: 200 },
	{ date: "2024-06-02", records: 470, flagged: 410 },
	{ date: "2024-06-03", records: 103, flagged: 160 },
	{ date: "2024-06-04", records: 439, flagged: 380 },
	{ date: "2024-06-05", records: 88, flagged: 140 },
	{ date: "2024-06-06", records: 294, flagged: 250 },
	{ date: "2024-06-07", records: 323, flagged: 370 },
	{ date: "2024-06-08", records: 385, flagged: 320 },
	{ date: "2024-06-09", records: 438, flagged: 480 },
	{ date: "2024-06-10", records: 155, flagged: 200 },
	{ date: "2024-06-11", records: 92, flagged: 150 },
	{ date: "2024-06-12", records: 492, flagged: 420 },
	{ date: "2024-06-13", records: 81, flagged: 130 },
	{ date: "2024-06-14", records: 426, flagged: 380 },
	{ date: "2024-06-15", records: 307, flagged: 350 },
	{ date: "2024-06-16", records: 371, flagged: 310 },
	{ date: "2024-06-17", records: 475, flagged: 520 },
	{ date: "2024-06-18", records: 107, flagged: 170 },
	{ date: "2024-06-19", records: 341, flagged: 290 },
	{ date: "2024-06-20", records: 408, flagged: 450 },
	{ date: "2024-06-21", records: 169, flagged: 210 },
	{ date: "2024-06-22", records: 317, flagged: 270 },
	{ date: "2024-06-23", records: 480, flagged: 530 },
	{ date: "2024-06-24", records: 132, flagged: 180 },
	{ date: "2024-06-25", records: 141, flagged: 190 },
	{ date: "2024-06-26", records: 434, flagged: 380 },
	{ date: "2024-06-27", records: 448, flagged: 490 },
	{ date: "2024-06-28", records: 149, flagged: 200 },
	{ date: "2024-06-29", records: 103, flagged: 160 },
	{ date: "2024-06-30", records: 446, flagged: 400 },
];

const chartConfig = {
	Records: {
		label: "Records",
	},
	records: {
		label: "Total",
		color: "var(--primary)",
	},
	flagged: {
		label: "Flagged",
		color: "#FF746F",
	},
} satisfies ChartConfig;

export function ChartAreaInteractive() {
	const isMobile = useIsMobile();
	const [timeRange, setTimeRange] = React.useState("90d");

	React.useEffect(() => {
		if (isMobile) {
			setTimeRange("7d");
		}
	}, [isMobile]);

	const filteredData = chartData.filter((item) => {
		const date = new Date(item.date);
		// TODO: Reference date should be current date
		const referenceDate = new Date("2024-06-30");
		let daysToSubtract = 90;
		if (timeRange === "30d") {
			daysToSubtract = 30;
		} else if (timeRange === "7d") {
			daysToSubtract = 7;
		} else if (timeRange === "1d") {
			daysToSubtract = 1;
		}
		const startDate = new Date(referenceDate);
		startDate.setDate(startDate.getDate() - daysToSubtract);
		return date >= startDate;
	});

	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Total attendance records</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Including flagged records (e.g. lacking verification methods)
					</span>
					<span className="@[540px]/card:hidden">Last 3 months</span>
				</CardDescription>
				<CardAction>
					<ToggleGroup
						multiple={false}
						value={timeRange ? [timeRange] : []}
						onValueChange={(value) => {
							setTimeRange(value[0] ?? "90d");
						}}
						variant="outline"
						className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
					>
						<ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
						<ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
						<ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
						<ToggleGroupItem value="1d">Last 24 hours</ToggleGroupItem>
					</ToggleGroup>
					<Select
						value={timeRange}
						onValueChange={(value) => {
							if (value !== null) {
								setTimeRange(value);
							}
						}}
					>
						<SelectTrigger
							className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
							size="sm"
							aria-label="Select a value"
						>
							<SelectValue placeholder="Last 3 months" />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectItem value="90d" className="rounded-lg">
								Last 3 months
							</SelectItem>
							<SelectItem value="30d" className="rounded-lg">
								Last 30 days
							</SelectItem>
							<SelectItem value="7d" className="rounded-lg">
								Last 7 days
							</SelectItem>
							<SelectItem value="1d" className="rounded-lg">
								Last 24 hours
							</SelectItem>
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<AreaChart data={filteredData}>
						<defs>
							<linearGradient id="fillRecords" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-records)"
									stopOpacity={1.0}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-records)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient id="fillFlagged" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-flagged)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-flagged)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => {
								const date = new Date(value);
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							}}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(value) => {
										return new Date(value).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
										});
									}}
									indicator="dot"
								/>
							}
						/>
						<Area
							dataKey="flagged"
							type="natural"
							fill="url(#fillFlagged)"
							stroke="var(--color-flagged)"
							strokeDasharray="4 4"
							stackId="a"
						/>
						<Area
							dataKey="records"
							type="natural"
							fill="url(#fillRecords)"
							stroke="var(--color-records)"
							stackId="a"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
