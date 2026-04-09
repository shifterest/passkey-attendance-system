"use client";

import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useContext,
	useEffect,
	useState,
} from "react";

type PageHeaderContextValue = {
	title: string;
	description: string;
	actions: ReactNode;
	setTitle: Dispatch<SetStateAction<string>>;
	setDescription: Dispatch<SetStateAction<string>>;
	setActions: Dispatch<SetStateAction<ReactNode>>;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [actions, setActions] = useState<ReactNode>(null);
	return (
		<PageHeaderContext
			value={{
				title,
				description,
				actions,
				setTitle,
				setDescription,
				setActions,
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
		actions: ctx.actions,
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
	const { setTitle, setDescription, setActions } = ctx;
	useEffect(() => {
		setTitle(title);
		return () => setTitle("");
	}, [title, setTitle]);
	useEffect(() => {
		setDescription(description ?? "");
		return () => setDescription("");
	}, [description, setDescription]);
	useEffect(() => {
		setActions(actions ?? null);
		return () => setActions(null);
	}, [actions, setActions]);
	return null;
}
