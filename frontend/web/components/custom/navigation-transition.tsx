"use client";

import { IconLoader } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

type NavigationPhase = "idle" | "pending" | "settling";

type NavigationTransitionContextValue = {
	beginNavigation: () => void;
	phase: NavigationPhase;
};

const NavigationTransitionContext =
	React.createContext<NavigationTransitionContextValue | null>(null);

const SETTLE_DURATION_MS = 180;
const FAILSAFE_DURATION_MS = 8000;

function isModifiedEvent(event: React.MouseEvent<HTMLAnchorElement>) {
	return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export function NavigationTransitionProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const [phase, setPhase] = React.useState<NavigationPhase>("idle");
	const startedRef = React.useRef(false);
	const routeKeyRef = React.useRef<string | null>(null);
	const settleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const failsafeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const clearTimers = React.useCallback(() => {
		if (settleTimeoutRef.current) {
			clearTimeout(settleTimeoutRef.current);
			settleTimeoutRef.current = null;
		}
		if (failsafeTimeoutRef.current) {
			clearTimeout(failsafeTimeoutRef.current);
			failsafeTimeoutRef.current = null;
		}
	}, []);

	const beginNavigation = React.useCallback(() => {
		clearTimers();
		startedRef.current = true;
		setPhase("pending");
		failsafeTimeoutRef.current = setTimeout(() => {
			startedRef.current = false;
			setPhase("idle");
			failsafeTimeoutRef.current = null;
		}, FAILSAFE_DURATION_MS);
	}, [clearTimers]);

	React.useEffect(() => {
		const searchKey =
			typeof window === "undefined" ? "" : window.location.search;
		const nextRouteKey = `${pathname}${searchKey}`;

		if (routeKeyRef.current === nextRouteKey) {
			return;
		}

		routeKeyRef.current = nextRouteKey;

		if (!startedRef.current) {
			return;
		}

		clearTimers();
		startedRef.current = false;
		setPhase("settling");
		settleTimeoutRef.current = setTimeout(() => {
			setPhase("idle");
			settleTimeoutRef.current = null;
		}, SETTLE_DURATION_MS);
	}, [clearTimers, pathname]);

	React.useEffect(() => {
		return () => clearTimers();
	}, [clearTimers]);

	const value = React.useMemo(
		() => ({ beginNavigation, phase }),
		[beginNavigation, phase],
	);

	return (
		<NavigationTransitionContext.Provider value={value}>
			{children}
		</NavigationTransitionContext.Provider>
	);
}

export function useNavigationTransition() {
	return React.useContext(NavigationTransitionContext);
}

export const TransitionLink = React.forwardRef<
	HTMLAnchorElement,
	React.ComponentProps<typeof Link>
>(function TransitionLink({ href, onClick, target, ...props }, ref) {
	const transition = useNavigationTransition();

	return (
		<Link
			ref={ref}
			href={href}
			target={target}
			{...props}
			onClick={(event) => {
				onClick?.(event);
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					isModifiedEvent(event) ||
					target === "_blank"
				) {
					return;
				}

				const hrefValue = event.currentTarget.getAttribute("href");
				if (!hrefValue) {
					return;
				}

				const nextUrl = new URL(hrefValue, window.location.href);
				if (nextUrl.origin !== window.location.origin) {
					return;
				}

				const currentRoute = `${window.location.pathname}${window.location.search}`;
				const nextRoute = `${nextUrl.pathname}${nextUrl.search}`;

				if (nextRoute === currentRoute) {
					return;
				}

				transition?.beginNavigation();
			}}
		/>
	);
});

export function NavigationTransitionContent({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	const phase = useNavigationTransition()?.phase ?? "idle";
	const isPending = phase === "pending";

	return (
		<div
			className={cn("relative flex flex-1 flex-col overflow-hidden", className)}
		>
			<div
				className={cn(
					"flex flex-1 flex-col transition-[filter,opacity,transform] will-change-[filter,opacity,transform]",
					phase === "pending" &&
						"duration-[700ms] ease-out blur-[3px] opacity-72 saturate-75 scale-[0.998]",
					phase === "settling" &&
						"duration-200 ease-out blur-0 opacity-100 saturate-100 scale-100",
				)}
			>
				{children}
			</div>
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-0 transition-opacity",
					isPending
						? "opacity-100 duration-500 ease-out"
						: "opacity-0 duration-150 ease-out",
				)}
			>
				<div className="absolute inset-0 bg-background/26" />
				<div
					className={cn(
						"absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center transition-all",
						isPending
							? "translate-y-0 opacity-100 delay-200 duration-300 ease-out"
							: "-translate-y-1 opacity-0 duration-150 ease-out",
					)}
				>
					<div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
						<IconLoader className="size-4 animate-spin" />
						<span className="text-sm text-muted-foreground">Loading</span>
					</div>
				</div>
			</div>
		</div>
	);
}
