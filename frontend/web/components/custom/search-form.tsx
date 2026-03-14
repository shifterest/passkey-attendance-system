"use client";

import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SearchForm({
	onSearch,
}: React.ComponentProps<"form"> & {
	onSearch?: (query: string) => void;
}) {
	const [query, setQuery] = useState("");

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		setQuery(value);
		onSearch?.(value);
	};

	return (
		<form>
			<div className="relative">
				<Label htmlFor="search" className="sr-only">
					Search
				</Label>
				<IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
				<Input
					id="search"
					placeholder="Search by name, ID or email"
					className="pl-8"
					value={query}
					onChange={handleChange}
				/>
			</div>
		</form>
	);
}
