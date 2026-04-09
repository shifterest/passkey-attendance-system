"use client";

import {
	createContext,
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

type PageHeaderContextValue = {
	title: string;
	description: string;
	setTitle: Dispatch<SetStateAction<string>>;
	setDescription: Dispatch<SetStateAction<string>>;
	actionsRef: RefObject<HTMLDivElement | null>;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const actionsRef = useRef<HTMLDivElement | null>(null);
	return (
		<PageHeaderContext
			value={{
				title,
				description,
				setTitle,
				setDescription,
				actionsRef,
			}}
		>
			{children}
		</PageHeaderContext>
	);
}

export function usePageHeaderState() {
	const ctx = useContext(PageHeaderContext);
	if (!ctx) throw new Error("usePageHeaderState requires PageHeaderProvider");
	return {
		title: ctx.title,
		description: ctx.description,
		actionsRef: ctx.actionsRef,
	};
}

export function SetPageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	const ctx = useContext(PageHeaderContext);
	if (!ctx) throw new Error("SetPageHeader requires PageHeaderProvider");
	const { setTitle, setDescription, actionsRef } = ctx;
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setTitle(title);
		return () => setTitle("");
	}, [title, setTitle]);
	useEffect(() => {
		setDescription(description ?? "");
		return () => setDescription("");
	}, [description, setDescription]);
	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);
	return mounted && actions && actionsRef.current
		? createPortal(actions, actionsRef.current)
		: null;
}
