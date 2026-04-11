import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function LoadingButton({
	loading,
	loadingText,
	children,
	disabled,
	...props
}: React.ComponentProps<typeof Button> & {
	loading?: boolean;
	loadingText?: string;
}) {
	return (
		<Button disabled={disabled || loading} {...props}>
			{loading ? (
				<>
					<Spinner /> {loadingText ?? children}
				</>
			) : (
				children
			)}
		</Button>
	);
}

export { LoadingButton };
