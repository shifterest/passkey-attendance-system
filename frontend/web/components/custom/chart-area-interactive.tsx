"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
	ChartLegend,
	ChartLegendContent,
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

const chartConfig = {
	records: {
		label: "Total",
		color: "var(--primary)",
	},
	flagged: {
		label: "Flagged",
		color: "var(--destructive)",
	},
} satisfies ChartConfig;

type ChartDatum = {
	date: string;
	records: number;
	flagged: number;
};

export function ChartAreaInteractive({ data }: { data: ChartDatum[] }) {
	const isMobile = useIsMobile();
	const [timeRange, setTimeRange] = React.useState("90d");

	React.useEffect(() => {
		if (isMobile) {
			setTimeRange("7d");
		}
	}, [isMobile]);

	const filteredData = data.filter((item) => {
		const date = new Date(item.date);
		const referenceDate = new Date();
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
					<BarChart accessibilityLayer data={filteredData}>
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
							content={
								<ChartTooltipContent
									labelFormatter={(value) => {
										return new Date(value).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
										});
									}}
									hideLabel
								/>
							}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						<Bar
							dataKey="records"
							stackId="a"
							fill="var(--color-records)"
							radius={[0, 0, 4, 4]}
						/>
						<Bar
							dataKey="flagged"
							stackId="a"
							fill="var(--color-flagged)"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
