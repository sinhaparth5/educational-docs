import { useEffect, useRef } from 'react';
import p5 from 'p5';

// Simple pendulum, integrated each frame: θ'' = -(g/L)·sin θ
export default function Pendulum() {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const sketch = new p5((s: p5) => {
			const L = 150;
			let theta = Math.PI / 3;
			let omega = 0;

			s.setup = () => s.createCanvas(400, 260);
			s.draw = () => {
				omega += -(9.81 / L) * Math.sin(theta) * 0.5;
				theta += omega * 0.5;
				const x = 200 + L * Math.sin(theta);
				const y = 20 + L * Math.cos(theta);
				s.background(34, 39, 46);
				s.stroke(173, 186, 199);
				s.line(200, 20, x, y);
				s.fill(219, 109, 40);
				s.circle(x, y, 24);
			};
		}, host.current!);
		return () => sketch.remove();
	}, []);

	return <div ref={host} />;
}
