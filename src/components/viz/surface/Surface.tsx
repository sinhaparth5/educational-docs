import { useEffect, useRef } from 'react';
import 'mathbox/mathbox.css';
import styles from './Surface.module.css';

// Animated surface z = sin(x)·cos(y + t); drag to orbit
export default function Surface() {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let mb: any;
		// Imported here, not at the top: threestrap can't load in Node during prerender
		Promise.all([import('mathbox'), import('three/examples/jsm/controls/OrbitControls.js')]).then(
			([{ mathBox }, { OrbitControls }]) => {
				mb = mathBox({
					element: host.current!,
					plugins: ['core', 'controls', 'cursor'],
					controls: { klass: OrbitControls },
				});
				mb.three.camera.position.set(2.5, 1.5, 2.5);
				mb.three.renderer.setClearColor(0x22272e, 1);

				const view = mb.cartesian({
					range: [
						[-3, 3],
						[-1, 1],
						[-3, 3],
					],
					scale: [1, 0.5, 1],
				});
				view.axis({ axis: 1 });
				view.axis({ axis: 3 });
				view.grid({ axes: [1, 3] });
				view
					.area({
						width: 48,
						height: 48,
						axes: [1, 3],
						channels: 3,
						expr: (emit: Function, x: number, y: number, _i: number, _j: number, t: number) =>
							emit(x, Math.sin(x) * Math.cos(y + t), y),
					})
					.surface({ color: '#3090ff', shaded: true });
			},
		);
		return () => mb?.three.destroy();
	}, []);

	return <div ref={host} className={styles.canvas} />;
}
