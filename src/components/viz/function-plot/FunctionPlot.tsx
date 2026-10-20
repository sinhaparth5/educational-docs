import { useId, useMemo, useRef, useState } from 'react';
import { Mafs, Coordinates, Plot } from 'mafs';
import 'mafs/core.css';
// Number-only build: much smaller than full mathjs, and enough for f(x)
import { compile } from 'mathjs/number';
import styles from './FunctionPlot.module.css';

type Params = Record<string, [min: number, max: number, start: number]>;

// About 100 slider positions, rounded to a power of ten so values land on round numbers
const niceStep = (min: number, max: number) => 10 ** Math.floor(Math.log10((max - min) / 100));

interface Props {
	/** Starting formula in x, e.g. "a * sin(b * x)" */
	expr?: string;
	/** Sliders: { a: [min, max, start] } */
	params?: Params;
	/** Let readers edit the formula */
	editable?: boolean;
}

/**
 * Plot f(x) with optional parameter sliders. In MDX:
 *   <FunctionPlot client:visible expr="a * sin(b * x)" params={{ a: [0, 3, 1], b: [0.5, 4, 1] }} />
 */
export default function FunctionPlot({ expr = 'sin(x)', params = {}, editable = true }: Props) {
	const id = useId();
	const [text, setText] = useState(expr);
	const [values, setValues] = useState(() =>
		Object.fromEntries(Object.entries(params).map(([k, [, , start]]) => [k, start])),
	);

	const parsed = useMemo(() => {
		try {
			const compiled = compile(text);
			compiled.evaluate({ x: 0, ...values }); // surface unknown names now, not per point
			return { compiled, error: '' };
		} catch (e) {
			return { compiled: null, error: (e as Error).message };
		}
	}, [text]);
	const { error } = parsed;
	// Keep drawing the last formula that parsed while the reader is mid-typing
	const lastGood = useRef(parsed.compiled);
	if (parsed.compiled) lastGood.current = parsed.compiled;

	const f = (x: number) => {
		try {
			const y = lastGood.current?.evaluate({ x, ...values });
			return typeof y === 'number' ? y : NaN;
		} catch {
			return NaN;
		}
	};

	return (
		<figure className={styles.plot}>
			{editable && (
				<div className={styles.formula}>
					<label htmlFor={`${id}-f`} className={styles.fx}>
						f(x) =
					</label>
					<input
						id={`${id}-f`}
						className={styles.input}
						value={text}
						onChange={(e) => setText(e.target.value)}
						spellCheck={false}
						autoComplete="off"
						aria-invalid={!!error}
						aria-describedby={error ? `${id}-err` : undefined}
					/>
				</div>
			)}
			{error && (
				<p id={`${id}-err`} className={styles.error} role="status">
					{error}
				</p>
			)}

			<Mafs height={300}>
				<Coordinates.Cartesian />
				<Plot.OfX y={f} />
			</Mafs>

			{Object.entries(params).map(([name, [min, max]]) => (
				<div key={name} className={styles.slider}>
					<label htmlFor={`${id}-${name}`} className={styles.name}>
						{name}
					</label>
					<input
						id={`${id}-${name}`}
						type="range"
						min={min}
						max={max}
						step={niceStep(min, max)}
						value={values[name]}
						onChange={(e) => setValues((v) => ({ ...v, [name]: Number(e.target.value) }))}
					/>
					<output htmlFor={`${id}-${name}`} className={styles.value}>
						{values[name].toFixed(2)}
					</output>
				</div>
			))}
		</figure>
	);
}
