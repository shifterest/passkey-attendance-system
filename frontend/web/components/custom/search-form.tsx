"use client";

import { IconSearch } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClassDto,
	getClasses,
	getUsers,
	type UserDto,
} from "@/app/lib/api";
import { getSearchPlaceholder } from "@/app/lib/navigation";
import { TransitionLink } from "@/components/custom/navigation-transition";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function userHref(role: string): string {
	if (role === "student") return "/students";
	if (role === "teacher") return "/teachers";
	if (role === "admin" || role === "operator") return "/admins";
	return "/users";
}

export function SearchForm({
	onSearch,
	placeholder,
}: {
	onSearch?: (query: string) => void;
	placeholder?: string;
} = {}) {
	const pathname = usePathname();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [users, setUsers] = useState<UserDto[]>([]);
	const [classes, setClasses] = useState<ClassDto[]>([]);
	const [loading, setLoading] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const usersCache = useRef<UserDto[] | null>(null);
	const classesCache = useRef<ClassDto[] | null>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	const doSearch = useCallback((q: string) => {
		const lower = q.toLowerCase().trim();
		if (!lower) {
			setUsers([]);
			setClasses([]);
			setOpen(false);
			return;
		}
		setOpen(true);
		setLoading(true);

		const filterUsers = (all: UserDto[]) =>
			all
				.filter(
					(u) =>
						u.full_name.toLowerCase().includes(lower) ||
						u.email.toLowerCase().includes(lower) ||
						u.school_id?.toLowerCase().includes(lower),
				)
				.slice(0, 5);

		const filterClasses = (all: ClassDto[]) =>
			all
				.filter(
					(c) =>
						c.course_code.toLowerCase().includes(lower) ||
						c.course_name.toLowerCase().includes(lower),
				)
				.slice(0, 5);

		if (usersCache.current) {
			setUsers(filterUsers(usersCache.current));
			setLoading(false);
		} else {
			getUsers()
				.then((all) => {
					usersCache.current = all;
					setUsers(filterUsers(all));
					setLoading(false);
				})
				.catch(() => setLoading(false));
		}

		if (classesCache.current) {
			setClasses(filterClasses(classesCache.current));
		} else {
			getClasses()
				.then((all) => {
					classesCache.current = all;
					setClasses(filterClasses(all));
				})
				.catch(() => {});
		}
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		setQuery(value);
		if (onSearch) {
			onSearch(value);
			return;
		}
		clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => doSearch(value), 300);
	};

	const hasResults = users.length > 0 || classes.length > 0;
	const resolvedPlaceholder = placeholder ?? getSearchPlaceholder(pathname);

	return (
		<div ref={containerRef} className="relative">
			<Label htmlFor="search" className="sr-only">
				Search
			</Label>
			<IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
			<Input
				id="search"
				placeholder={resolvedPlaceholder}
				className="pl-8"
				value={query}
				onChange={handleChange}
				onFocus={() => query.trim() && setOpen(true)}
			/>
			{!onSearch && open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-popover p-1 shadow-md">
					{loading && !hasResults && (
						<p className="px-2 py-1.5 text-xs text-muted-foreground">
							Searching...
						</p>
					)}
					{users.length > 0 && (
						<>
							<p className="px-2 py-1 text-xs font-medium text-muted-foreground">
								Users
							</p>
							{users.map((u) => (
								<TransitionLink
									key={u.id}
									href={userHref(u.role)}
									onClick={() => setOpen(false)}
									className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
								>
									<span className="truncate">{u.full_name}</span>
									<Badge variant="outline" className="ml-auto capitalize">
										{u.role}
									</Badge>
								</TransitionLink>
							))}
						</>
					)}
					{users.length > 0 && classes.length > 0 && (
						<Separator className="my-1" />
					)}
					{classes.length > 0 && (
						<>
							<p className="px-2 py-1 text-xs font-medium text-muted-foreground">
								Classes
							</p>
							{classes.map((c) => (
								<TransitionLink
									key={c.id}
									href={`/classes/${c.id}/sessions`}
									onClick={() => setOpen(false)}
									className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
								>
									<span className="truncate">{c.course_code}</span>
									<span className="ml-auto truncate text-xs text-muted-foreground">
										{c.course_name}
									</span>
								</TransitionLink>
							))}
						</>
					)}
					{!loading && !hasResults && query.trim() && (
						<p className="px-2 py-1.5 text-xs text-muted-foreground">
							No results found
						</p>
					)}
				</div>
			)}
		</div>
	);
}
