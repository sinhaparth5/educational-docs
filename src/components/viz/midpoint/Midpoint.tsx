import { useEffect, useRef } from 'react';
import JXG from 'jsxgraph';
// jsxgraph's exports map hides its CSS, so import it by path
import '/node_modules/jsxgraph/distrib/jsxgraph.css';
import styles from './Midpoint.module.css';

// Drag A or B: the midpoint M and the circle on diameter AB update with them
export default function Midpoint() {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const board = JXG.JSXGraph.initBoard(host.current!, {
			boundingbox: [-5, 5, 5, -5],
			axis: true,
			showCopyright: false,
			showNavigation: false,
		});
		const a = board.create('point', [-3, -1], { name: 'A' });
		const b = board.create('point', [2, 2], { name: 'B' });
		board.create('segment', [a, b]);
		const m = board.create('midpoint', [a, b], { name: 'M' });
		board.create('circle', [m, a], { strokeColor: '#888' });
		return () => JXG.JSXGraph.freeBoard(board);
	}, []);

	return <div ref={host} className={`jxgbox ${styles.board}`} />;
}
