"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FormSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	trigger?: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
	contentClassName?: string;
	bodyClassName?: string;
	side?: "top" | "right" | "bottom" | "left";
};

export function FormSheet({
	open,
	onOpenChange,
	title,
	description,
	trigger,
	children,
	footer,
	contentClassName,
	bodyClassName,
	side = "right",
}: FormSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{trigger ? (
				<SheetTrigger
					render={React.isValidElement(trigger) ? trigger : undefined}
				>
					{!React.isValidElement(trigger) ? trigger : null}
				</SheetTrigger>
			) : null}
			<SheetContent
				side={side}
				className={cn("w-full p-0 sm:max-w-xl", contentClassName)}
			>
				<SheetHeader className="gap-1 border-b">
					<SheetTitle>{title}</SheetTitle>
					{description ? (
						<SheetDescription>{description}</SheetDescription>
					) : null}
				</SheetHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className={cn("space-y-6 p-6", bodyClassName)}>{children}</div>
				</ScrollArea>
				{footer ? (
					<SheetFooter className="border-t">{footer}</SheetFooter>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

export function FormSheetCancelButton({
	children = "Cancel",
}: {
	children?: React.ReactNode;
}) {
	return (
		<SheetClose render={<Button variant="outline" />}>{children}</SheetClose>
	);
}
