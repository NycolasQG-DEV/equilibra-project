"use client";

import { useEffect, useRef } from "react";

export function PlanosCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const container = containerRef.current;
    if (!container) return;

    // Load Three.js dynamically via CDN if window.THREE is not present
    let isThreeLoaded = typeof (window as any).THREE !== "undefined";

    const startThreeScene = (THREE: any) => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 30;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Create glowing particle field
      const particleCount = 120;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const scales = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        scales[i] = Math.random() * 0.4 + 0.1;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const particleMaterial = new THREE.PointsMaterial({
        color: 0x8b5cf6,
        size: 0.6,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, particleMaterial);
      scene.add(particles);

      // Create 3 floating wireframe/glass geometry shapes
      const shapes: any[] = [];
      const geometries = [
        new THREE.IcosahedronGeometry(3.5, 1),
        new THREE.TorusGeometry(3, 0.8, 16, 50),
        new THREE.OctahedronGeometry(3.2, 0),
      ];

      const colors = [0x542589, 0x3d1a6e, 0x8b5cf6];

      geometries.forEach((geo, idx) => {
        const mat = new THREE.MeshBasicMaterial({
          color: colors[idx],
          wireframe: true,
          transparent: true,
          opacity: 0.22,
        });
        const mesh = new THREE.Mesh(geo, mat);

        if (idx === 0) mesh.position.set(-18, 10, -5);
        if (idx === 1) mesh.position.set(20, -8, -10);
        if (idx === 2) mesh.position.set(-15, -12, -8);

        scene.add(mesh);
        shapes.push(mesh);
      });

      // Mouse interactive parallax
      let mouseX = 0;
      let mouseY = 0;
      const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMouseMove);

      const onResize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // Render loop
      const animate = () => {
        animId = requestAnimationFrame(animate);

        // Smooth camera movement with mouse
        camera.position.x += (mouseX * 4 - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 4 - camera.position.y) * 0.03;
        camera.lookAt(scene.position);

        // Rotate shapes
        shapes.forEach((s, idx) => {
          s.rotation.x += 0.003 * (idx + 1);
          s.rotation.y += 0.005 * (idx + 1);
        });

        // Rotate particles field
        particles.rotation.y += 0.0008;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(animId);
        if (renderer.domElement) container.removeChild(renderer.domElement);
        renderer.dispose();
      };
    };

    // Canvas fallback if Three.js is not loaded
    const startFallbackCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.pointerEvents = "none";
      container.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return () => {};

      let particles = Array.from({ length: 60 }).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.4 + 0.1,
      }));

      const render = () => {
        animId = requestAnimationFrame(render);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((p) => {
          p.x += p.dx;
          p.y += p.dy;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
          ctx.fill();
        });
      };
      render();

      return () => {
        cancelAnimationFrame(animId);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    };

    let cleanupFn: () => void = () => {};

    if (isThreeLoaded) {
      cleanupFn = startThreeScene((window as any).THREE) || (() => {});
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).THREE) {
          cleanupFn = startThreeScene((window as any).THREE) || (() => {});
        } else {
          cleanupFn = startFallbackCanvas();
        }
      };
      script.onerror = () => {
        cleanupFn = startFallbackCanvas();
      };
      document.head.appendChild(script);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-60"
      style={{ filter: "blur(0.5px)" }}
    />
  );
}
