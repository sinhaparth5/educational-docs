// A RISC-V chip on a circuit board, drawn as ASCII on a canvas cell grid
// (method after stackedlol/ascii-sharks):
//   1. static layer, painted once: board dots, copper traces, vias, pins, and the chip
//      body shaded with a density ramp, with RV32 engraved in negative space
//   2. signal pulses running along the traces
//   3. a heat field: pulses and the pointer deposit energy, which spreads by the
//      discrete heat equation u += α∇²u and decays, lighting the cells it reaches

const STEP = 1 / 60;
const ALPHA = 0.16; // diffusion rate, stable below 0.25
const DECAY = 0.955;
const GLOW = ' .:-=+*#'; // heat ramp on bare board

// 3×5 bitmap font, one string per row
const FONT: Record<string, string[]> = {
	R: ['##.', '#.#', '##.', '#.#', '#.#'],
	V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
	'3': ['###', '..#', '.##', '..#', '###'],
	'2': ['###', '..#', '###', '#..', '###'],
};

const EMPTY = 0, DOT = 1, TRACE = 2, VIA = 3, PIN = 4, BODY = 5, LABEL = 6;

// Deterministic hash → [0, 1), so the board layout is the same on every visit
function hash(x: number, y: number, z = 0) {
	let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Pulse = { trace: number; pos: number; speed: number };

export class Board {
	private ctx: CanvasRenderingContext2D;
	private bg = document.createElement('canvas');
	private w = 0;
	private h = 0;
	private dpr = 1;
	private fs = 10;
	private cw = 6;
	private ch = 10;
	private cols = 0;
	private rows = 0;
	private glyph: string[] = [];
	private kind = new Uint8Array(0);
	private shade = new Float32Array(0); // chip body opacity per cell
	private heat = new Float32Array(0);
	private tmp = new Float32Array(0);
	private traces: number[][] = []; // cell indices from the pin outward
	private pulses: Pulse[] = [];
	private clock = 0;
	private colors = { fg: '#000', muted: '#666', accent: '#2c6e69' };
	pointer = { x: 0, y: 0, active: false };

	constructor(private canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2D canvas unavailable');
		this.ctx = ctx;
	}

	/** Reads theme colours from CSS variables; call again when the theme changes. */
	setColors() {
		const s = getComputedStyle(this.canvas);
		const v = (n: string) => s.getPropertyValue(n).trim();
		this.colors = { fg: v('--fg'), muted: v('--muted'), accent: v('--accent') };
		this.paintStatic();
	}

	resize(w: number, h: number, dpr: number) {
		this.w = w;
		this.h = h;
		this.dpr = dpr;
		this.fs = Math.max(9, Math.min(12, w / 66));
		this.ctx.font = this.font();
		this.cw = this.ctx.measureText('M').width;
		this.ch = this.fs * 0.95;
		this.cols = Math.ceil(w / this.cw);
		this.rows = Math.ceil(h / this.ch);
		for (const c of [this.canvas, this.bg]) {
			c.width = Math.round(w * dpr);
			c.height = Math.round(h * dpr);
		}
		const n = this.cols * this.rows;
		this.glyph = Array<string>(n).fill(' ');
		this.kind = new Uint8Array(n);
		this.shade = new Float32Array(n);
		this.heat = new Float32Array(n);
		this.tmp = new Float32Array(n);
		this.pulses = [];
		this.layout();
		this.setColors();
	}

	private font() {
		return `${this.fs}px ${getComputedStyle(this.canvas).fontFamily}`;
	}

	private set(x: number, y: number, k: number, g: string) {
		if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
		const i = y * this.cols + x;
		if (this.kind[i] >= PIN && k < PIN) return -1; // never route over the chip or its pins
		this.kind[i] = k;
		this.glyph[i] = g;
		return i;
	}

	private layout() {
		const { cols: C, rows: R } = this;
		const aspect = this.cw / this.ch;

		// Board texture: a sparse dot grid
		for (let y = 0; y < R; y++) for (let x = y % 2; x < C; x += 2) this.set(x, y, DOT, '.');

		// Chip body, roughly square on screen
		const W = Math.min(C - 20, Math.max(36, Math.min(40, Math.round(C * 0.32)))); // 36+ fits the label at double width
		const H = Math.max(9, Math.min(R - 10, Math.round(W * aspect * 0.75)));
		const x0 = Math.floor((C - W) / 2), y0 = Math.floor((R - H) / 2);
		const cx = x0 + W / 2, cy = y0 + H / 2;
		for (let y = y0; y < y0 + H; y++)
			for (let x = x0; x < x0 + W; x++) {
				// Light from the top left: bright bevel there, dense shadow bottom right,
				// and a smooth gradient across the top so the label reads cleanly
				const top = y === y0 || x === x0, bottom = y === y0 + H - 1 || x === x0 + W - 1;
				const i = this.set(x, y, BODY, top ? ':' : bottom ? '@' : '#');
				this.shade[i] = top ? 0.5 : bottom ? 1 : 0.45 + 0.4 * ((x - x0) / W + (y - y0) / H) / 2;
			}
		this.set(x0 + 2, y0 + 1, LABEL, 'o'); // pin 1 mark

		// RV32 printed on the package, double width when there's room
		const sx = W >= 36 ? 2 : 1;
		const text = 'RV32';
		const tw = text.length * 3 * sx + (text.length - 1) * sx;
		const tx = Math.round(cx - tw / 2), ty = Math.round(cy - 2.5);
		[...text].forEach((c, k) =>
			FONT[c].forEach((row, r) =>
				[...row].forEach((p, col) => {
					if (p !== '#') return;
					for (let s = 0; s < sx; s++) this.set(tx + (k * 4 + col) * sx + s, ty + r, LABEL, '@');
				}),
			),
		);

		// Pins, and a trace leaving each one: straight out, a 45° fan away from the centre, straight to the edge
		this.traces = [];
		const route = (path: [number, number][]) => {
			const cells: number[] = [];
			const stop = 0.55 + 0.45 * hash(path[0][0], path[0][1], 7); // some end early on a via
			const n = Math.max(3, Math.floor(path.length * stop));
			for (let k = 0; k < n; k++) {
				const [x, y] = path[k];
				const [px, py] = k > 0 ? path[k - 1] : [2 * x - path[1][0], 2 * y - path[1][1]]; // first cell faces the next
				const g = k === n - 1 && stop < 1 ? 'o' : x === px ? '|' : y === py ? '-' : (x - px) * (y - py) < 0 ? '/' : '\\';
				const i = this.set(x, y, k === n - 1 && stop < 1 ? VIA : TRACE, g);
				if (i >= 0) cells.push(i);
			}
			if (cells.length > 2) this.traces.push(cells);
		};

		for (let x = x0 + 2; x < x0 + W - 1; x += 2) {
			const fan = Math.sign(x - cx);
			for (const dir of [-1, 1]) {
				const yPin = dir < 0 ? y0 - 1 : y0 + H;
				this.set(x, yPin, PIN, '|');
				const space = dir < 0 ? y0 - 2 : R - (y0 + H) - 1;
				const diag = Math.min(Math.round(Math.abs(x - cx) * 0.6), Math.max(0, space - 2));
				const path: [number, number][] = [];
				let px = x, py = yPin + dir;
				for (let k = 0; py >= 0 && py < R; k++) {
					path.push([px, py]);
					py += dir;
					if (k >= 1 && k < 1 + diag) px += fan;
				}
				route(path);
			}
		}
		for (let y = y0 + 1; y < y0 + H - 1; y++) {
			const fan = Math.sign(y - cy);
			for (const dir of [-1, 1]) {
				const xPin = dir < 0 ? x0 - 1 : x0 + W;
				this.set(xPin, y, PIN, '=');
				const diag = Math.round(Math.abs(y - cy) * 0.9);
				const path: [number, number][] = [];
				let px = xPin + dir, py = y;
				for (let k = 0; px >= 0 && px < C; k++) {
					path.push([px, py]);
					px += dir;
					if (k >= 2 && k < 2 + diag && py + fan >= 0 && py + fan < R) py += fan;
				}
				route(path);
			}
		}
	}

	private paintStatic() {
		const g = this.bg.getContext('2d');
		if (!g) return;
		g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		g.clearRect(0, 0, this.w, this.h);
		g.font = this.font();
		g.textBaseline = 'top';
		const { fg, muted } = this.colors;
		for (let i = 0; i < this.kind.length; i++) {
			const k = this.kind[i];
			if (k === EMPTY || this.glyph[i] === ' ') continue;
			g.fillStyle = k === LABEL ? this.colors.accent : k === BODY || k === PIN ? fg : muted;
			g.globalAlpha = k === DOT ? 0.22 : k === TRACE ? 0.6 : k === BODY ? this.shade[i] : k === LABEL ? 1 : 0.85;
			g.fillText(this.glyph[i], (i % this.cols) * this.cw, Math.floor(i / this.cols) * this.ch);
		}
		g.globalAlpha = 1;
	}

	/** Sends a pulse down every trace, plus a splash of heat at (x, y). */
	burst(x?: number, y?: number) {
		for (let t = 0; t < this.traces.length; t++) this.pulses.push({ trace: t, pos: -hash(t, 3) * 6, speed: 22 + hash(t, 9) * 14 });
		if (x !== undefined && y !== undefined) this.warm(x, y, 3, 2.5);
	}

	private warm(px: number, py: number, radius: number, amount: number) {
		const cx = px / this.cw, cy = py / this.ch;
		for (let y = Math.floor(cy - radius); y <= cy + radius; y++)
			for (let x = Math.floor(cx - radius * 1.6); x <= cx + radius * 1.6; x++) {
				if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
				const d = Math.hypot((x - cx) / 1.6, y - cy);
				if (d < radius) this.heat[y * this.cols + x] += amount * (1 - d / radius);
			}
	}

	step(dt: number) {
		this.clock += dt;

		// A steady trickle of traffic: each trace fires on its own seeded schedule
		const tick = Math.floor(this.clock * 4);
		if (tick !== Math.floor((this.clock - dt) * 4))
			for (let t = 0; t < this.traces.length; t++)
				if (hash(t, tick, 1) < 0.015) this.pulses.push({ trace: t, pos: 0, speed: 18 + hash(t, tick, 2) * 18 });

		for (const p of this.pulses) {
			p.pos += p.speed * dt;
			const cells = this.traces[p.trace];
			const k = Math.floor(p.pos);
			if (k >= 0 && k < cells.length) this.heat[cells[k]] += 0.35;
		}
		this.pulses = this.pulses.filter((p) => p.pos < this.traces[p.trace].length + 4);

		if (this.pointer.active) this.warm(this.pointer.x, this.pointer.y, 2.2, 0.12);

		// Heat equation on the grid (5-point Laplacian), then decay
		const { cols: C, rows: R, heat: u, tmp } = this;
		for (let y = 0; y < R; y++)
			for (let x = 0; x < C; x++) {
				const i = y * C + x;
				const lap = (x > 0 ? u[i - 1] : 0) + (x < C - 1 ? u[i + 1] : 0) + (y > 0 ? u[i - C] : 0) + (y < R - 1 ? u[i + C] : 0) - 4 * u[i];
				tmp[i] = (u[i] + ALPHA * lap) * DECAY;
			}
		this.heat = tmp;
		this.tmp = u;
	}

	render() {
		const { ctx, cw, ch, cols } = this;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.drawImage(this.bg, 0, 0);
		ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		ctx.font = this.font();
		ctx.textBaseline = 'top';
		ctx.fillStyle = this.colors.accent;

		// Warm cells: copper lights up in the accent, bare board glows with the heat ramp
		for (let i = 0; i < this.heat.length; i++) {
			const e = this.heat[i];
			const k = this.kind[i];
			if (e < 0.04 || k >= BODY) continue;
			const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
			if (k === TRACE || k === VIA || k === PIN) {
				ctx.globalAlpha = Math.min(1, 0.3 + e);
				ctx.clearRect(x, y, cw, ch);
				ctx.fillText(this.glyph[i], x, y);
			} else {
				const g = GLOW[Math.min(GLOW.length - 1, Math.ceil(e * 6))];
				ctx.globalAlpha = Math.min(0.8, e * 1.2);
				ctx.clearRect(x, y, cw, ch);
				ctx.fillText(g, x, y);
			}
		}

		// Pulse heads, with tails drawn in the trace's own glyph so the copper stays legible
		for (const p of this.pulses) {
			const cells = this.traces[p.trace];
			for (let k = 0; k < 6; k++) {
				const at = Math.floor(p.pos) - k;
				if (at < 0 || at >= cells.length) continue;
				const i = cells[at];
				const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
				ctx.globalAlpha = 1 - k * 0.15;
				ctx.clearRect(x, y, cw, ch);
				ctx.fillText(k === 0 ? '@' : this.glyph[i], x, y);
			}
		}
		ctx.globalAlpha = 1;
	}
}

export { STEP };
