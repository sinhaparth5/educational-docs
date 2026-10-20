import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { palette, useTheme } from '@/lib/theme';
import viz from '../viz.module.css';
import styles from './Surface.module.css';

type Colors = (typeof palette)['light'];

// Animated surface y = ½·sin(x)·cos(z + t) over [-3, 3]²; drag to orbit
export default function Surface() {
	const host = useRef<HTMLDivElement>(null);
	const theme = useTheme();
	// Set by the scene effect, called on theme change so the scene isn't rebuilt
	const recolor = useRef<(c: Colors) => void>(null);

	useEffect(() => {
		const el = host.current!;
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		el.append(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
		camera.position.set(6, 4.5, 6);
		const baseDistance = camera.position.length();
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.enableZoom = false; // let the page scroll over the canvas

		scene.add(new THREE.AmbientLight(0xffffff, 1.2));
		const sun = new THREE.DirectionalLight(0xffffff, 2);
		sun.position.set(3, 6, 2);
		scene.add(sun);

		// 48×48 grid in the xz-plane; heights are rewritten every frame
		const geometry = new THREE.PlaneGeometry(6, 6, 48, 48).rotateX(-Math.PI / 2);
		const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 });
		scene.add(new THREE.Mesh(geometry, material));
		const position = geometry.attributes.position;

		const axesMaterial = new THREE.LineBasicMaterial();
		const axesGeometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(-3.5, 0, 0),
			new THREE.Vector3(3.5, 0, 0),
			new THREE.Vector3(0, 0, -3.5),
			new THREE.Vector3(0, 0, 3.5),
		]);
		scene.add(new THREE.LineSegments(axesGeometry, axesMaterial));
		let grid: THREE.GridHelper | undefined;

		recolor.current = (c) => {
			renderer.setClearColor(c.bg);
			material.color.set(c.accent);
			axesMaterial.color.set(c.fg);
			if (grid) {
				scene.remove(grid);
				grid.dispose();
			}
			grid = new THREE.GridHelper(6, 12, c.grid, c.grid);
			grid.position.y = -0.6;
			scene.add(grid);
		};

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = el;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			// Narrow canvases crop the sides, so pull the camera back to keep the surface in frame
			camera.position.setLength(baseDistance * Math.max(1, 1.5 / camera.aspect));
		};
		const resizer = new ResizeObserver(resize);
		resizer.observe(el);

		const timer = new THREE.Timer();
		const frame = () => {
			timer.update();
			const t = timer.getElapsed();
			for (let i = 0; i < position.count; i++) {
				const x = position.getX(i);
				const z = position.getZ(i);
				position.setY(i, 0.5 * Math.sin(x) * Math.cos(z + t));
			}
			position.needsUpdate = true;
			geometry.computeVertexNormals();
			controls.update();
			renderer.render(scene, camera);
		};

		// Only animate while on screen
		const visibility = new IntersectionObserver(([entry]) =>
			renderer.setAnimationLoop(entry.isIntersecting ? frame : null),
		);
		visibility.observe(el);

		return () => {
			visibility.disconnect();
			resizer.disconnect();
			renderer.setAnimationLoop(null);
			controls.dispose();
			grid?.dispose();
			geometry.dispose();
			material.dispose();
			axesGeometry.dispose();
			axesMaterial.dispose();
			renderer.dispose();
			renderer.domElement.remove();
			recolor.current = null;
		};
	}, []);

	// Runs after the scene effect on mount, then on every theme switch
	useEffect(() => recolor.current?.(palette[theme]), [theme]);

	return <div ref={host} className={`${viz.frame} ${styles.canvas}`} />;
}
