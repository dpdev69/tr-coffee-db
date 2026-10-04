"use client";

import { useEffect, useRef, useState } from "react";
import type { BufferGeometry, InstancedMesh, Material } from "three";

/** Decorative coffee sack. Pointer events come from the hero, so links remain clickable. */
export function CoffeeScene({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup = () => {};

    async function mount() {
      try {
        const THREE = await import("three").then(({
          WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Scene, OrthographicCamera,
          HemisphereLight, DirectionalLight, SphereGeometry, Vector3, TubeGeometry,
          CatmullRomCurve3, InstancedMesh, MeshStandardMaterial, DynamicDrawUsage, Object3D, Color,
        }) => ({
          WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Scene, OrthographicCamera,
          HemisphereLight, DirectionalLight, SphereGeometry, Vector3, TubeGeometry,
          CatmullRomCurve3, InstancedMesh, MeshStandardMaterial, DynamicDrawUsage, Object3D, Color,
        }));
        if (cancelled || !host) return;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;";
        host.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 30);
        camera.position.z = 12;
        const geometries: BufferGeometry[] = [];
        const materials: Material[] = [];
        const geometry = <T extends BufferGeometry>(value: T): T => { geometries.push(value); return value; };
        const material = <T extends Material>(value: T): T => { materials.push(value); return value; };
        const observers: { resize?: ResizeObserver; intersection?: IntersectionObserver } = {};
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const hero = host.parentElement?.parentElement || host;
        let reduceMotion = preference.matches;
        let inView = true;
        let disposed = false;
        let loopRunning = false;
        let lastTime = 0;
        let viewWidth = 16;
        let viewHeight = 10;
        const pointer = { x: 0, y: 0, active: false };
        const instances: { body?: InstancedMesh; seams?: InstancedMesh } = {};

        cleanup = () => {
          if (disposed) return;
          disposed = true;
          renderer.setAnimationLoop(null);
          observers.resize?.disconnect();
          observers.intersection?.disconnect();
          preference.removeEventListener("change", onPreference);
          document.removeEventListener("visibilitychange", syncMotion);
          hero.removeEventListener("pointermove", onPointer);
          hero.removeEventListener("pointerdown", onPointer);
          hero.removeEventListener("pointerleave", onLeave);
          hero.removeEventListener("pointercancel", onLeave);
          renderer.domElement.removeEventListener("webglcontextlost", onContextLoss);
          instances.body?.dispose();
          instances.seams?.dispose();
          geometries.forEach((item) => item.dispose());
          materials.forEach((item) => item.dispose());
          renderer.dispose();
          renderer.domElement.remove();
        };

        scene.add(new THREE.HemisphereLight("#fff1d9", "#362317", 1.8));
        const daylight = new THREE.DirectionalLight("#ffe9c7", 2.2);
        daylight.position.set(-4, 6, 8);
        scene.add(daylight);
        const fill = new THREE.DirectionalLight("#d9b398", 0.8);
        fill.position.set(5, -3, 4);
        scene.add(fill);

        // Sculpt a real crease into the bean as well as a dark seam inside it.
        const beanShape = geometry(new THREE.SphereGeometry(1, 24, 16));
        const positions = beanShape.attributes.position;
        for (let index = 0; index < positions.count; index++) {
          const x = positions.getX(index); const y = positions.getY(index); const z = positions.getZ(index);
          const crease = Math.sin(y * 3.8) * 0.035;
          const indentation = z > 0 ? 0.19 * Math.exp(-Math.pow((x - crease) / 0.13, 2)) * Math.sqrt(Math.max(0, 1 - y * y)) : 0;
          positions.setXYZ(index, x * 0.61, y * 0.96, z * 0.4 - indentation);
        }
        beanShape.computeVertexNormals();
        const seamPoints = Array.from({ length: 17 }, (_, index) => {
          const y = -0.82 + index / 16 * 1.64;
          return new THREE.Vector3(Math.sin(y * 3.8) * 0.021, y * 0.96, Math.sqrt(1 - y * y) * 0.235);
        });
        const seamShape = geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints), 20, 0.018, 5, false));
        const count = 180;
        instances.body = new THREE.InstancedMesh(beanShape, material(new THREE.MeshStandardMaterial({ color: "#56301b", roughness: 0.68 })), count);
        instances.seams = new THREE.InstancedMesh(seamShape, material(new THREE.MeshStandardMaterial({ color: "#302015", roughness: 0.94 })), count);
        instances.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instances.seams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instances.body.frustumCulled = false;
        instances.seams.frustumCulled = false;
        scene.add(instances.body, instances.seams);
        const random = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
        const beans = Array.from({ length: count }, (_, index) => ({
          x: 0, y: 0, z: random(index + 101) * 0.3,
          scale: 1, angle: random(index + 1) * Math.PI * 2,
          tiltX: (random(index + 4) - 0.5) * 0.65, tiltY: (random(index + 5) - 0.5) * 0.65,
          dx: 0, dy: 0, vx: 0, vy: 0, roll: 0, spin: 0,
        }));
        const matrix = new THREE.Object3D();
        beans.forEach((_, index) => {
          instances.body!.setColorAt(index, new THREE.Color().setHSL(0.065 + random(index + 7) * 0.025, 0.3 + random(index + 8) * 0.2, 0.4 + random(index + 9) * 0.2));
        });
        function updateMatrices() {
          beans.forEach((bean, index) => {
            matrix.position.set(bean.x + bean.dx, bean.y + bean.dy, bean.z + Math.abs(bean.roll) * 0.12);
            matrix.rotation.set(bean.tiltX + bean.roll * 0.5, bean.tiltY + bean.roll * 0.7, bean.angle + bean.roll);
            matrix.scale.setScalar(bean.scale);
            matrix.updateMatrix();
            instances.body!.setMatrixAt(index, matrix.matrix);
            instances.seams!.setMatrixAt(index, matrix.matrix);
          });
          instances.body!.instanceMatrix.needsUpdate = true;
          instances.seams!.instanceMatrix.needsUpdate = true;
        }
        function render() { if (!disposed) renderer.render(scene, camera); }
        function stop() { renderer.setAnimationLoop(null); loopRunning = false; lastTime = 0; }
        function animate(time: number) {
          const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 1 / 60;
          lastTime = time;
          const damping = Math.exp(-5.3 * dt);
          let energy = 0;
          for (const bean of beans) {
            bean.vx = (bean.vx - bean.dx * 15 * dt) * damping;
            bean.vy = (bean.vy - bean.dy * 15 * dt) * damping;
            bean.spin = (bean.spin - bean.roll * 12 * dt) * damping;
            bean.dx += bean.vx * dt; bean.dy += bean.vy * dt; bean.roll += bean.spin * dt;
            energy += Math.abs(bean.vx) + Math.abs(bean.vy) + Math.abs(bean.dx) + Math.abs(bean.dy) + Math.abs(bean.spin) + Math.abs(bean.roll);
          }
          updateMatrices();
          render();
          if (energy < 0.006) stop();
        }
        function syncMotion() {
          if (disposed) return;
          if (cancelled || reduceMotion || !inView || document.hidden) { pointer.active = false; stop(); return; }
          if (!loopRunning) { loopRunning = true; lastTime = 0; renderer.setAnimationLoop(animate); }
        }
        function onPointer(event: PointerEvent) {
          if (disposed || reduceMotion || !inView || document.hidden) return;
          const rect = host!.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width - 0.5) * viewWidth;
          const y = (0.5 - (event.clientY - rect.top) / rect.height) * viewHeight;
          const dx = pointer.active ? Math.max(-0.7, Math.min(0.7, x - pointer.x)) : 0.12;
          const dy = pointer.active ? Math.max(-0.7, Math.min(0.7, y - pointer.y)) : 0.04;
          pointer.x = x; pointer.y = y; pointer.active = true;
          const radius = Math.min(viewWidth, viewHeight) * 0.23;
          for (const bean of beans) {
            const distance = Math.hypot(bean.x + bean.dx - x, bean.y + bean.dy - y);
            if (distance > radius) continue;
            const force = Math.pow(1 - distance / radius, 2);
            bean.vx = Math.max(-7, Math.min(7, bean.vx + dx * force * 8));
            bean.vy = Math.max(-7, Math.min(7, bean.vy + dy * force * 8));
            bean.spin = Math.max(-6, Math.min(6, bean.spin + (dx * 3.4 + dy * 1.4) * force));
          }
          syncMotion();
        }
        function onLeave() { pointer.active = false; }
        function onPreference() { reduceMotion = preference.matches; setReduced(reduceMotion); syncMotion(); }
        function onContextLoss(event: Event) { event.preventDefault(); cleanup(); setReady(false); }
        function resize() {
          const { width, height } = host!.getBoundingClientRect();
          if (!width || !height || disposed) return;
          viewHeight = 10;
          viewWidth = viewHeight * width / height;
          camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
          camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
          camera.updateProjectionMatrix();
          const columns = Math.max(6, Math.round(Math.sqrt(count * width / height * 1.3)));
          const rows = Math.ceil(count / columns);
          const cellWidth = viewWidth / Math.max(1, columns - 1);
          const cellHeight = viewHeight / Math.max(1, rows - 1);
          const scale = Math.max(cellWidth / 1.2, cellHeight / 1.8) * 1.12;
          beans.forEach((bean, index) => {
            bean.x = (index % columns) * cellWidth - viewWidth / 2 + (random(index + 20) - 0.5) * cellWidth * 0.5;
            bean.y = Math.floor(index / columns) * cellHeight - viewHeight / 2 + (random(index + 21) - 0.5) * cellHeight * 0.45;
            bean.scale = scale * (0.85 + random(index + 22) * 0.3);
            bean.dx = bean.dy = bean.vx = bean.vy = bean.roll = bean.spin = 0;
          });
          updateMatrices();
          renderer.setSize(width, height, false);
          render();
        }
        preference.addEventListener("change", onPreference);
        document.addEventListener("visibilitychange", syncMotion);
        hero.addEventListener("pointermove", onPointer, { passive: true });
        hero.addEventListener("pointerdown", onPointer, { passive: true });
        hero.addEventListener("pointerleave", onLeave, { passive: true });
        hero.addEventListener("pointercancel", onLeave, { passive: true });
        renderer.domElement.addEventListener("webglcontextlost", onContextLoss);
        observers.resize = new ResizeObserver(resize);
        observers.resize.observe(host);
        observers.intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncMotion(); });
        observers.intersection.observe(host);
        resize();
        setReduced(reduceMotion);
        setReady(true);
      } catch {
        cleanup();
        if (!cancelled) setReady(false);
      }
    }
    const idle = typeof window.requestIdleCallback === "function";
    const pending = idle
      ? window.requestIdleCallback(() => void mount(), { timeout: 1000 })
      : window.setTimeout(() => void mount(), 1000);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(pending);
      else window.clearTimeout(pending);
      cleanup();
    };
  }, []);

  return (
    <div className={`coffee-scene coffee-scene-background ${className}`} aria-hidden="true" data-scene-state={ready ? (reduced ? "reduced-motion" : "interactive") : "fallback"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }}>
      <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: ready ? 0 : 0.38 }}>
        {Array.from({ length: 108 }, (_, index) => {
          const x = index % 12 * 109 - 15 + Math.sin(index * 7) * 17;
          const y = Math.floor(index / 12) * 77 + Math.cos(index * 3) * 14;
          return <g key={index} transform={`translate(${x} ${y}) rotate(${index * 137.5 % 360})`}><ellipse rx="38" ry="58" fill={index % 3 === 0 ? "#8b6145" : index % 3 === 1 ? "#76523b" : "#9a7252"} /><path d="M0-49C-17-15 16 13 0 49" stroke="#483221" strokeWidth="4" fill="none" /></g>;
        })}
      </svg>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, opacity: ready ? 0.83 : 0 }} />
    </div>
  );
}
