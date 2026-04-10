export interface SelectLabelOption<TValue extends string = string> {
	value: TValue;
	label: string;
}

export function getSelectLabel<TValue extends string>(
	value: TValue | null | undefined,
	options: readonly SelectLabelOption<TValue>[],
) {
	if (!value) {
		return undefined;
	}

	return options.find((option) => option.value === value)?.label;
}
