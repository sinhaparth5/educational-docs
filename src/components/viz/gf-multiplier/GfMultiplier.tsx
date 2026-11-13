import { useEffect, useState } from 'react';
import styles from './GfMultiplier.module.css';

const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const parse = (s: string) => (/^(0x)?[0-9a-f]{1,2}$/i.test(s.trim()) ? parseInt(s.trim().replace(/^0x/i, ''), 16) : null);
const SUP = '⁰¹²³⁴⁵⁶⁷';

// Bits of a byte as a GF(2) polynomial, highest power first
function poly(n: number) {
	const terms: string[] = [];
	for (let i = 7; i >= 0; i--) if ((n >> i) & 1) terms.push(i === 0 ? '1' : i === 1 ? 'x' : `x${SUP[i]}`);
	return terms.join(' + ') || '0';
}

// One row per bit of b: a·xⁱ via xtime, and the running XOR of the rows where bᵢ = 1
export function steps(a: number, b: number) {
	const rows = [];
	let cur = a;
	let acc = 0;
	for (let i = 0; i < 8; i++) {
		let shifted = cur;
		let reduced = false;
		if (i > 0) {
			shifted = cur << 1;
			reduced = (shifted & 0x100) !== 0;
			cur = reduced ? shifted ^ 0x11b : shifted;
		}
		const bit = (b >> i) & 1;
		const prev = acc;
		if (bit) acc ^= cur;
		rows.push({ i, shifted, reduced, value: cur, bit, prev, acc });
	}
	return rows;
}

type Row = ReturnType<typeof steps>[number];

// Nine cells, bit 8 down to bit 0; bit 8 is the overflow slot
function Bits({ n, blank8, changed = 0 }: { n: number; blank8?: boolean; changed?: number }) {
	return (
		<span className={styles.bits}>
			{Array.from({ length: 9 }, (_, k) => {
				const i = 8 - k;
				const on = (n >> i) & 1;
				const cls = [styles.bit, i === 8 && styles.overflow, on && styles.on, (changed >> i) & 1 && styles.flip]
					.filter(Boolean)
					.join(' ');
				return (
					<span key={i} className={cls}>
						{i === 8 && blank8 ? '' : on}
					</span>
				);
			})}
		</span>
	);
}

// The bit-level view of one step: shift, optional reduction, then the XOR into the result
function Detail({ r }: { r: Row }) {
	return (
		<div className={styles.detail} key={r.i} aria-hidden="true">
			<span className={`${styles.label} ${styles.r1}`}>{r.i === 0 ? 'a · x⁰' : 'shift left'}</span>
			<span className={`${styles.r1} ${r.i > 0 ? styles.slide : ''}`}>
				<Bits n={r.shifted} />
			</span>

			<span className={`${styles.label} ${styles.r2}`}>{r.reduced ? '⊕ 0x11B' : ''}</span>
			<span className={styles.r2}>
				{r.reduced ? <Bits n={0x11b} /> : <span className={styles.note}>{r.i === 0 ? 'start with a' : 'bit 8 is 0, no reduction'}</span>}
			</span>

			<span className={`${styles.label} ${styles.r3}`}>a · x{SUP[r.i]}</span>
			<span className={styles.r3}>
				<Bits n={r.value} />
			</span>

			<span className={`${styles.label} ${styles.r4}`}>{r.bit ? `b${'₀₁₂₃₄₅₆₇'[r.i]} = 1, ⊕` : `b${'₀₁₂₃₄₅₆₇'[r.i]} = 0, skip`}</span>
			<span className={styles.r4}>
				<Bits n={r.acc} blank8 changed={r.prev ^ r.acc} />
			</span>
		</div>
	);
}

// Step through shift-and-XOR multiplication of two bytes in GF(2⁸) mod 0x11B
export default function GfMultiplier() {
	const [aText, setAText] = useState('57');
	const [bText, setBText] = useState('83');
	const [shown, setShown] = useState(8);
	const [playing, setPlaying] = useState(false);
	const a = parse(aText);
	const b = parse(bText);
	const rows = a !== null && b !== null ? steps(a, b) : [];
	const done = shown >= 8;

	// Autoplay advances one bit at a time and stops on the last one
	useEffect(() => {
		if (!playing) return;
		if (done) return setPlaying(false);
		const t = setTimeout(() => setShown((s) => s + 1), 1500);
		return () => clearTimeout(t);
	}, [playing, shown, done]);

	const play = () => {
		if (playing) return setPlaying(false);
		if (done) setShown(1);
		setPlaying(true);
	};

	const input = (label: string, value: string, set: (s: string) => void, ok: boolean) => (
		<label className={styles.field}>
			<span>{label} = 0x</span>
			<input
				className={styles.input}
				value={value}
				maxLength={4}
				spellCheck={false}
				aria-invalid={!ok}
				onChange={(e) => {
					set(e.target.value);
					setPlaying(false);
					setShown(8);
				}}
			/>
		</label>
	);

	const current = rows[Math.min(shown, 8) - 1];

	return (
		<figure className={styles.box}>
			<div className={styles.controls}>
				{input('a', aText, setAText, a !== null)}
				<span className={styles.times}>·</span>
				{input('b', bText, setBText, b !== null)}
				<span className={styles.buttons}>
					<button className={styles.button} onClick={play} disabled={!rows.length}>
						{playing ? 'Pause' : 'Play'}
					</button>
					<button
						className={styles.button}
						onClick={() => {
							setPlaying(false);
							setShown(done ? 1 : shown + 1);
						}}
						disabled={!rows.length}
					>
						{done ? 'Step' : `Next bit (${shown}/8)`}
					</button>
					{!done && (
						<button
							className={styles.button}
							onClick={() => {
								setPlaying(false);
								setShown(8);
							}}
						>
							Show all
						</button>
					)}
				</span>
			</div>
			{rows.length === 0 ? (
				<p className={styles.error}>Enter two bytes in hex, 00 to FF.</p>
			) : (
				<>
					<p className={styles.poly}>
						a(x) = {poly(a!)}
						<br />
						b(x) = {poly(b!)}
					</p>
					{current && <Detail r={current} />}
					<table>
						<thead>
							<tr>
								<th>i</th>
								<th>bit i of b</th>
								<th>a · xⁱ</th>
								<th>running XOR</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.i} className={r.i >= shown ? styles.hidden : r.i === shown - 1 && !done ? styles.current : undefined}>
									<td>{r.i}</td>
									<td>{r.bit}</td>
									<td>
										{r.i === 0
											? hex(r.value)
											: r.reduced
												? `${'0x' + r.shifted.toString(16).toUpperCase()} ⊕ 0x11B = ${hex(r.value)}`
												: `shift → ${hex(r.value)}`}
									</td>
									<td>{r.bit ? `⊕ ${hex(r.value)} = ${hex(r.acc)}` : `skip, ${hex(r.acc)}`}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p className={styles.result} aria-live="polite">
						{done ? `${hex(a!)} · ${hex(b!)} = ${hex(rows[7].acc)}  (${poly(rows[7].acc)})` : ' '}
					</p>
				</>
			)}
			<figcaption className={styles.caption}>
				Each row multiplies the previous one by x: shift left, and XOR with 0x11B if bit 8 is set. Rows where b has a 1 get
				XORed into the result. The bit strip shows the step that is currently highlighted.
			</figcaption>
		</figure>
	);
}
