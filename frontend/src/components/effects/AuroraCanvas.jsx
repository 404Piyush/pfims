// AuroraCanvas.jsx — WebGL aurora backdrop.
//
// Renders a full-viewport <canvas> with a custom fragment shader that mixes
// 3 cloud-like colour layers (indigo / cyan / pink), animated on noise + time.
// Pointer parallax, prefers-reduced-motion fallback (static gradient), and
// visibility-pause are handled here.

import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec2 } from 'ogl';

const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Domain-warped fractal noise, blended in 3 colour stops that drift slowly.
// `uMouse` parallax influences the noise translation for a subtle parallax.
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uColorC;
uniform float uIntensity;

// 2D simplex-ish hash noise (cheap, GPU-friendly)
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy);
  vec2 m  = uMouse * 0.18;

  float t = uTime * 0.06;
  vec2 q = vec2(fbm(uv * 2.0 + t + m),
                fbm(uv * 2.0 + vec2(1.7, 9.2) - t * 0.7 + m));
  float n = fbm(uv * 2.5 + q * 2.5 + t * 0.5);

  // Three colour layers, weighted by different fbm samples.
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, n));
  col      = mix(col,      uColorC, smoothstep(0.4, 1.0, fbm(uv * 3.0 - q * 1.5 + t)));

  // Vignette + grain so it doesn't look "too digital"
  float vig = smoothstep(1.2, 0.35, length(uv - 0.5));
  col *= vig;

  // Subtle film grain (very cheap).
  float g = (hash(gl_FragCoord.xy * 0.5 + uTime) - 0.5) * 0.025;
  col += g;

  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

const hexToRGB = (hex) => {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return [r, g, b];
};

export default function AuroraCanvas({
  colors = { a: '#6366f1', b: '#06b6d4', c: '#ec4899' },
  intensity = 0.65,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);
  const rafRef = useRef(0);
  const visibleRef = useRef(true);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect prefers-reduced-motion and document visibility
    reducedMotionRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        alpha: true,
        antialias: true,
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vec2(1, 1) },
          uMouse: { value: new Vec2(0, 0) },
          uColorA: { value: hexToRGB(colors.a) },
          uColorB: { value: hexToRGB(colors.b) },
          uColorC: { value: hexToRGB(colors.c) },
          uIntensity: { value: intensity },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      let mouseX = 0, mouseY = 0;
      const onMove = (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      };

      const resize = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value.set(w, h);
      };

      const onVis = () => {
        visibleRef.current = !document.hidden;
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', onVis);
      resize();

      const start = performance.now();
      const loop = (now) => {
        if (visibleRef.current && !reducedMotionRef.current) {
          program.uniforms.uTime.value = (now - start) / 1000;
          program.uniforms.uMouse.value.set(mouseX, -mouseY);
          renderer.render({ scene: mesh });
        } else if (reducedMotionRef.current) {
          // Single-frame static gradient — drawn once.
          program.uniforms.uTime.value = 0;
          program.uniforms.uMouse.value.set(0, 0);
          renderer.render({ scene: mesh });
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // Mount the renderer canvas into our container.
      const canvasEl = renderer.gl.canvas;
      canvasEl.style.position = 'absolute';
      canvasEl.style.inset = '0';
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      canvasEl.style.display = 'block';
      canvasEl.setAttribute('aria-hidden', 'true');
      container.appendChild(canvasEl);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        try {
          canvasEl.parentNode && canvasEl.parentNode.removeChild(canvasEl);
        } catch (_) {}
      };
    } catch (err) {
      // WebGL unavailable — fall back to a CSS gradient.
      container.classList.add('aurora-fallback');
      // eslint-disable-next-line no-console
      console.warn('AuroraCanvas: WebGL unavailable, using CSS fallback.', err?.message || err);
    }
  }, [colors.a, colors.b, colors.c, intensity]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
