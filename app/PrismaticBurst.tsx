"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

export type AnimationType = "rotate" | "rotate3d" | "hover";

type PrismaticBurstProps = {
  intensity?: number;
  speed?: number;
  animationType?: AnimationType;
  colors?: string[];
  distort?: number;
  paused?: boolean;
  offset?: { x?: number | string; y?: number | string };
  hoverDampness?: number;
  hoverDisplacement?: number;
  rayCount?: number;
  mixBlendMode?: React.CSSProperties["mixBlendMode"] | "none";
};

export const vertexShader = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform int uAnimType;
uniform vec2 uMouse;
uniform float uHoverActive;
uniform float uHoverDisplacement;
uniform int uColorCount;
uniform float uDistort;
uniform vec2 uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int uRayCount;

float hash21(vec2 p){
  p = floor(p);
  float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
  return fract(f);
}

mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

float layeredNoise(vec2 fragPx){
  vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
  vec2 q = rot30() * p;
  float n = 0.0;
  n += 0.40 * hash21(q);
  n += 0.25 * hash21(q * 2.0 + 17.0);
  n += 0.20 * hash21(q * 4.0 + 47.0);
  n += 0.10 * hash21(q * 8.0 + 113.0);
  n += 0.05 * hash21(q * 16.0 + 191.0);
  return n;
}

vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist){
  float focal = res.y * max(dist, 1e-3);
  return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset){
  vec2 toC = frag - 0.5 * res - offset;
  float r = length(toC) / (0.5 * min(res.x, res.y));
  float x = clamp(r, 0.0, 1.0);
  float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  float s = q * 0.5;
  s = pow(s, 1.5);
  float tail = 1.0 - pow(1.0 - s, 2.0);
  s = mix(s, tail, 0.2);
  float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
  return clamp(s + dn, 0.0, 1.0);
}

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t){
  return texture(uGradient, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
}

vec2 rot2(vec2 v, float a){
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c) * v;
}

float bendAngle(vec3 q, float t){
  return 0.8 * sin(q.x * 0.55 + t * 0.6)
    + 0.7 * sin(q.y * 0.50 - t * 0.5)
    + 0.6 * sin(q.z * 0.60 + t * 0.7);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  float t = uTime * uSpeed;
  float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
  vec2 uv = frag / uResolution;
  vec2 mouseUv = vec2(uMouse.x, 1.0 - uMouse.y);
  vec2 aspect = uResolution / min(uResolution.x, uResolution.y);
  vec2 centered = (uv - 0.5) * aspect;
  vec2 pointerDelta = (uv - mouseUv) * aspect;
  float pointerDistance = length(pointerDelta);
  vec2 pointerDir = normalize(pointerDelta + vec2(0.0001));
  vec2 pointerSwirl = vec2(-pointerDir.y, pointerDir.x);

  // The same asymmetric liquid lens used by the supplied dot-matrix
  // reference. Warping the sampling point (rather than only steering the ray)
  // gives the burst its broad, viscous pull and trailing swirl.
  float pointerAngle = atan(pointerDelta.y, pointerDelta.x);
  float falloffWobble = 0.86
    + 0.13 * sin(pointerAngle * 3.0 + t * 0.42)
    + 0.08 * sin(pointerAngle * 5.0 - t * 0.31);
  float hover = uHoverActive * uHoverDisplacement
    * (1.0 - smoothstep(0.035, 0.47 * falloffWobble, pointerDistance));
  float liquidBand = hover * smoothstep(0.015, 0.15, pointerDistance);
  float shear = sin(pointerAngle * 2.0 - t * 0.65) * 0.5 + 0.5;
  centered += pointerSwirl * liquidBand * mix(0.008, 0.027, shear);
  centered += pointerDir * liquidBand * 0.019;

  vec2 warpedUv = centered / aspect + 0.5;
  vec2 warpedFrag = warpedUv * uResolution;
  vec3 dir = rayDir(warpedFrag, uResolution, uOffset, 1.0);

  float marchT = 0.0;
  vec3 col = vec3(0.0);
  float n = layeredNoise(frag);
  vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
  mat2 M2 = mat2(c.x, c.y, c.z, c.w);
  float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

  mat3 rot3dMat = mat3(1.0);
  if(uAnimType == 1){
    vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
    rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
  }
  mat3 hoverMat = mat3(1.0);
  if(uAnimType == 2){
    vec2 m = uMouse * 2.0 - 1.0;
    vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
    hoverMat = rotY(ang.y) * rotX(ang.x);
  }

  for (int i = 0; i < 44; ++i) {
    vec3 P = marchT * dir;
    P.z -= 2.0;
    float rad = length(P);
    vec3 Pl = P * (10.0 / max(rad, 1e-6));

    if(uAnimType == 0){
      Pl.xz *= M2;
    } else if(uAnimType == 1){
      Pl = rot3dMat * Pl;
    } else {
      Pl = hoverMat * Pl;
    }

    float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;
    float grow = smoothstep(0.35, 3.0, marchT);
    float a1 = amp * grow * bendAngle(Pl * 0.6, t);
    float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
    vec3 Pb = Pl;
    Pb.xz = rot2(Pb.xz, a1);
    Pb.xy = rot2(Pb.xy, a2);

    float rayPattern = smoothstep(
      0.5, 0.7,
      sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
      sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
    );

    if (uRayCount > 0) {
      float ang = atan(Pb.y, Pb.x);
      float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
      comb = pow(comb, 3.0);
      rayPattern *= smoothstep(0.15, 0.95, comb);
    }

    vec3 spectralDefault = 1.0 + vec3(
      cos(marchT * 3.0 + 0.0),
      cos(marchT * 3.0 + 1.0),
      cos(marchT * 3.0 + 2.0)
    );
    float saw = fract(marchT * 0.25);
    float tRay = saw * saw * (3.0 - 2.0 * saw);
    vec3 userGradient = 2.0 * sampleGradient(tRay);
    vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
    vec3 base = (0.05 / (0.4 + stepLen))
      * smoothstep(5.0, 0.0, rad)
      * spectral;

    col += base * rayPattern;
    marchT += stepLen;
  }

  col *= edgeFade(frag, uResolution, uOffset);
  col *= uIntensity;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const hexToRgb01 = (hex: string) => {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) value = value.split("").map((char) => char + char).join("");
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed) || value.length !== 6) return [1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
};

const toPx = (value: number | string | undefined) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value).replace("px", ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function PrismaticBurst({
  intensity = 2,
  speed = 0.5,
  animationType = "rotate3d",
  colors,
  distort = 0,
  paused = false,
  offset = { x: 0, y: 0 },
  hoverDampness = 0,
  hoverDisplacement = 1,
  rayCount,
  mixBlendMode = "lighten",
}: PrismaticBurstProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const gradientRef = useRef<Texture | null>(null);
  const mouseTargetRef = useRef([0.5, 0.5]);
  const mouseSmoothRef = useRef([0.5, 0.5]);
  const hoverTargetRef = useRef(0);
  const hoverSmoothRef = useRef(0);
  const pausedRef = useRef(paused);
  const dampnessRef = useRef(hoverDampness);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { dampnessRef.current = hoverDampness; }, [hoverDampness]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: false,
      antialias: false,
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    Object.assign(gl.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      mixBlendMode: mixBlendMode === "none" ? "" : mixBlendMode,
    });
    container.appendChild(gl.canvas);

    const gradient = new Texture(gl, {
      image: new Uint8Array([255, 255, 255, 255]),
      width: 1,
      height: 1,
      generateMipmaps: false,
      flipY: false,
    });
    gradient.minFilter = gl.LINEAR;
    gradient.magFilter = gl.LINEAR;
    gradient.wrapS = gl.CLAMP_TO_EDGE;
    gradient.wrapT = gl.CLAMP_TO_EDGE;
    gradientRef.current = gradient;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uResolution: { value: [1, 1] },
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uSpeed: { value: 1 },
        uAnimType: { value: 1 },
        uMouse: { value: [0.5, 0.5] },
        uHoverActive: { value: 0 },
        uHoverDisplacement: { value: 1 },
        uColorCount: { value: 0 },
        uDistort: { value: 0 },
        uOffset: { value: [0, 0] },
        uGradient: { value: gradient },
        uNoiseAmount: { value: 0.8 },
        uRayCount: { value: 0 },
      },
    });
    programRef.current = program;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
      program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseTargetRef.current = [
        Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1),
        Math.min(Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0), 1),
      ];
      hoverTargetRef.current = 1;
    };
    const onPointerEnter = () => { hoverTargetRef.current = 1; };
    const onPointerLeave = () => { hoverTargetRef.current = 0; };
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerenter", onPointerEnter, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    const render = (now: number) => {
      const delta = Math.max(0, now - last) * 0.001;
      last = now;
      if (!pausedRef.current) elapsed += delta;
      const tau = 0.02 + Math.min(Math.max(dampnessRef.current, 0), 1) * 0.5;
      const alpha = 1 - Math.exp(-delta / tau);
      const target = mouseTargetRef.current;
      const smooth = mouseSmoothRef.current;
      smooth[0] += (target[0] - smooth[0]) * alpha;
      smooth[1] += (target[1] - smooth[1]) * alpha;
      hoverSmoothRef.current += (hoverTargetRef.current - hoverSmoothRef.current) * alpha;
      program.uniforms.uMouse.value = smooth;
      program.uniforms.uHoverActive.value = hoverSmoothRef.current;
      program.uniforms.uTime.value = elapsed;
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerenter", onPointerEnter);
      container.removeEventListener("pointerleave", onPointerLeave);
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
      programRef.current = null;
      rendererRef.current = null;
      gradientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = rendererRef.current?.gl.canvas;
    if (canvas) canvas.style.mixBlendMode = mixBlendMode === "none" ? "" : mixBlendMode;
  }, [mixBlendMode]);

  useEffect(() => {
    const program = programRef.current;
    const renderer = rendererRef.current;
    const gradient = gradientRef.current;
    if (!program || !renderer || !gradient) return;

    program.uniforms.uIntensity.value = intensity;
    program.uniforms.uSpeed.value = speed;
    program.uniforms.uAnimType.value = { rotate: 0, rotate3d: 1, hover: 2 }[animationType];
    program.uniforms.uDistort.value = distort;
    program.uniforms.uOffset.value = [toPx(offset.x), toPx(offset.y)];
    program.uniforms.uRayCount.value = Math.max(0, Math.floor(rayCount ?? 0));
    program.uniforms.uHoverDisplacement.value = hoverDisplacement;

    let count = 0;
    if (colors?.length) {
      const capped = colors.slice(0, 64);
      count = capped.length;
      const data = new Uint8Array(count * 4);
      capped.forEach((color, index) => {
        const [r, g, b] = hexToRgb01(color);
        data.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255], index * 4);
      });
      gradient.image = data;
      gradient.width = count;
      gradient.height = 1;
      gradient.minFilter = renderer.gl.LINEAR;
      gradient.magFilter = renderer.gl.LINEAR;
      gradient.wrapS = renderer.gl.CLAMP_TO_EDGE;
      gradient.wrapT = renderer.gl.CLAMP_TO_EDGE;
      gradient.flipY = false;
      gradient.generateMipmaps = false;
      gradient.format = renderer.gl.RGBA;
      gradient.type = renderer.gl.UNSIGNED_BYTE;
      gradient.needsUpdate = true;
    }
    program.uniforms.uColorCount.value = count;
  }, [intensity, speed, animationType, colors, distort, offset.x, offset.y, rayCount, hoverDisplacement]);

  return <div className="prismatic-burst-container" ref={containerRef} />;
}
