export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Large-target radio group (mobile-first). */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-[var(--surface)] p-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-2 text-sm ${
            o.value === value ? "bg-accent font-medium text-black" : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
