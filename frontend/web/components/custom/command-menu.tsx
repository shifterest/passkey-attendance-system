"use client";

import { IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClassDto,
	getClasses,
	getUsers,
	type UserDto,
} from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";

function userHref(role: string): string {
	if (role === "student") return "/students";
	if (role === "teacher") return "/teachers";
	if (role === "admin" || role === "operator") return "/admins";
	return "/users";
}

export function CommandMenu() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [users, setUsers] = useState<UserDto[]>([]);
	const [classes, setClasses] = useState<ClassDto[]>([]);
	const usersCache = useRef<UserDto[] | null>(null);
	const classesCache = useRef<ClassDto[] | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const doSearch = useCallback((q: string) => {
		const lower = q.toLowerCase().trim();
		if (!lower) {
			setUsers([]);
			setClasses([]);
			return;
		}

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
		} else {
			getUsers()
				.then((all) => {
					usersCache.current = all;
					setUsers(filterUsers(all));
				})
				.catch(() => {});
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

	function handleValueChange(value: string) {
		setQuery(value);
		clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => doSearch(value), 200);
	}

	function navigate(href: string) {
		setOpen(false);
		setQuery("");
		setUsers([]);
		setClasses([]);
		router.push(href);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent"
			>
				<IconSearch className="size-4 shrink-0" />
				<span className="flex-1 text-left">Search...</span>
				<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
					<span className="text-xs">⌘</span>K
				</kbd>
			</button>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				title="Search"
				description="Search for users and classes"
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search users, classes..."
						value={query}
						onValueChange={handleValueChange}
					/>
					<CommandList>
						{query.trim() && users.length === 0 && classes.length === 0 && (
							<CommandEmpty>No results found.</CommandEmpty>
						)}
						{users.length > 0 && (
							<CommandGroup heading="Users">
								{users.map((u) => (
									<CommandItem
										key={u.id}
										onSelect={() => navigate(userHref(u.role))}
									>
										<span className="truncate">{u.full_name}</span>
										<Badge variant="outline" className="ml-auto capitalize">
											{u.role}
										</Badge>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{users.length > 0 && classes.length > 0 && <CommandSeparator />}
						{classes.length > 0 && (
							<CommandGroup heading="Classes">
								{classes.map((c) => (
									<CommandItem
										key={c.id}
										onSelect={() => navigate(`/classes/${c.id}/sessions`)}
									>
										<span className="truncate">{c.course_code}</span>
										<span className="ml-auto truncate text-xs text-muted-foreground">
											{c.course_name}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
