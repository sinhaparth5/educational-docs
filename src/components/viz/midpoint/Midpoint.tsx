import { useEffect, useRef } from 'react';
import JXG from 'jsxgraph';
// jsxgraph's exports map hides its CSS, so import it by path
import '/node_modules/jsxgraph/distrib/jsxgraph.css';
import { palette, useTheme } from '@/lib/theme';
import viz from '../viz.module.css';
import styles from './Midpoint.module.css';

// Drag A or B: the midpoint M and the circle on diameter AB update with them
export default function Midpoint() {
	const host = useRef<HTMLDivElement>(null);
	const theme = useTheme();

	// JSXGraph bakes colors in at creation, so rebuild the board on theme change
	useEffect(() => {
		const c = palette[theme];
		const axis = { strokeColor: c.fg, ticks: { strokeColor: c.grid, label: { strokeColor: c.fg } } };
		const board = JXG.JSXGraph.initBoard(host.current!, {
			boundingbox: [-5, 5, 5, -5],
			axis: true,
			defaultAxes: { x: axis, y: axis },
			showCopyright: false,
			showNavigation: false,
		});
		const label = { strokeColor: c.fg };
		const a = board.create('point', [-3, -1], { name: 'A', color: c.accent, label });
		const b = board.create('point', [2, 2], { name: 'B', color: c.accent, label });
		board.create('segment', [a, b], { strokeColor: c.accent });
		const m = board.create('midpoint', [a, b], { name: 'M', color: c.fg, label });
		board.create('circle', [m, a], { strokeColor: c.fg, strokeOpacity: 0.5 });
		return () => JXG.JSXGraph.freeBoard(board);
	}, [theme]);

	return <div ref={host} className={`jxgbox ${viz.frame} ${styles.board}`} />;
}
