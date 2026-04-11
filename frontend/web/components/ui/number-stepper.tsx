import { IconMinus, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";

function NumberStepper({
	id,
	value,
	onChange,
	min = 0,
	max = 100,
	step = 1,
}: {
	id?: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}) {
	const clamp = (v: number) => Math.max(min, Math.min(max, v));

	return (
		<ButtonGroup>
			<Input
				id={id}
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) =>
					onChange(clamp(Number(event.currentTarget.value) || min))
				}
				className="h-8 w-16 text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				onClick={() => onChange(clamp(value - step))}
				disabled={value <= min}
			>
				<IconMinus />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				onClick={() => onChange(clamp(value + step))}
				disabled={value >= max}
			>
				<IconPlus />
			</Button>
		</ButtonGroup>
	);
}

export { NumberStepper };
