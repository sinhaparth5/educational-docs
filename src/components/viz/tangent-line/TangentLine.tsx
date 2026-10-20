import { Mafs, Coordinates, Plot, Theme, useMovablePoint } from 'mafs';
import 'mafs/core.css';

// Drag the point along sin(x); the tangent follows with slope cos(x)
export default function TangentLine() {
	const p = useMovablePoint([1, Math.sin(1)], {
		constrain: ([x]) => [x, Math.sin(x)],
	});
	const slope = Math.cos(p.x);

	return (
		<Mafs height={300}>
			<Coordinates.Cartesian />
			<Plot.OfX y={Math.sin} />
			<Plot.OfX y={(x) => slope * (x - p.x) + p.y} color={Theme.orange} />
			{p.element}
		</Mafs>
	);
}
