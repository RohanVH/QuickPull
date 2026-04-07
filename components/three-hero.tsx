"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import * as THREE from "three";

export function ThreeHero() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.6, 5.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const count = 1200;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: "#4df6ff",
      size: 0.03,
      transparent: true,
      opacity: 0.85
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const ambient = new THREE.AmbientLight("#7ba0ff", 2.1);
    const rim = new THREE.PointLight("#ff4fd8", 30, 20);
    rim.position.set(2.8, 1.5, 3.5);
    scene.add(ambient, rim);

    const cursor = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      cursor.x = (event.clientX / window.innerWidth - 0.5) * 0.3;
      cursor.y = (event.clientY / window.innerHeight - 0.5) * 0.3;
    };

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.65, 1),
      new THREE.MeshBasicMaterial({
        color: "#ff4fd8",
        wireframe: true,
        transparent: true,
        opacity: 0.18
      })
    );
    orb.position.set(-1.8, 0.8, -1.2);
    scene.add(orb);

    gsap.to(orb.rotation, {
      x: Math.PI * 2,
      y: Math.PI * 2,
      duration: 18,
      repeat: -1,
      ease: "none"
    });

    let frame = 0;
    const animate = () => {
      points.rotation.y += 0.0008;
      points.rotation.x += 0.0004;
      camera.position.x += (cursor.x - camera.position.x) * 0.02;
      camera.position.y += (cursor.y + 0.6 - camera.position.y) * 0.02;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
