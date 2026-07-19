import { fragmentShader, vertexShader, type AnimationType } from "./PrismaticBurst";

export type WebflowShaderSettings = {
  intensity: number;
  speed: number;
  animationType: AnimationType;
  colors: string[];
  distort: number;
  hoverDampness: number;
  hoverDisplacement: number;
  rayCount: number;
  paused: boolean;
};

export function createWebflowEmbed(settings: WebflowShaderSettings) {
  const exported = JSON.stringify(settings);
  const vertex = JSON.stringify(vertexShader);
  const fragment = JSON.stringify(fragmentShader);

  return `<div id="prismatic-burst-webflow" style="position:relative;width:100%;height:100%;min-height:500px;overflow:hidden;background:#000;"></div>
<script type="module">
import { Renderer, Program, Mesh, Triangle, Texture } from "https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js";

const root = document.getElementById("prismatic-burst-webflow");
if (root) {
  const settings = ${exported};
  const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: false, antialias: false });
  const gl = renderer.gl;
  Object.assign(gl.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", mixBlendMode: "lighten" });
  root.appendChild(gl.canvas);

  const gradient = new Texture(gl, {
    image: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1,
    generateMipmaps: false, flipY: false
  });
  gradient.minFilter = gl.LINEAR;
  gradient.magFilter = gl.LINEAR;
  gradient.wrapS = gl.CLAMP_TO_EDGE;
  gradient.wrapT = gl.CLAMP_TO_EDGE;

  const program = new Program(gl, {
    vertex: ${vertex},
    fragment: ${fragment},
    uniforms: {
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
      uIntensity: { value: settings.intensity },
      uSpeed: { value: settings.speed },
      uAnimType: { value: { rotate: 0, rotate3d: 1, hover: 2 }[settings.animationType] },
      uMouse: { value: [0.5, 0.5] },
      uHoverActive: { value: 0 },
      uHoverDisplacement: { value: settings.hoverDisplacement },
      uColorCount: { value: settings.colors.length },
      uDistort: { value: settings.distort },
      uOffset: { value: [0, 0] },
      uGradient: { value: gradient },
      uNoiseAmount: { value: 0.8 },
      uRayCount: { value: Math.max(0, Math.floor(settings.rayCount)) }
    }
  });

  const hexToRgb = hex => {
    let value = hex.trim().replace(/^#/, "");
    if (value.length === 3) value = value.split("").map(char => char + char).join("");
    const parsed = Number.parseInt(value, 16);
    return Number.isNaN(parsed) ? [255, 255, 255] : [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
  };
  const colorData = new Uint8Array(settings.colors.length * 4);
  settings.colors.forEach((color, index) => {
    const [r, g, b] = hexToRgb(color);
    colorData.set([r, g, b, 255], index * 4);
  });
  gradient.image = colorData;
  gradient.width = settings.colors.length;
  gradient.height = 1;
  gradient.format = gl.RGBA;
  gradient.type = gl.UNSIGNED_BYTE;
  gradient.needsUpdate = true;

  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  const mouseTarget = [0.5, 0.5];
  const mouseSmooth = [0.5, 0.5];
  let hoverTarget = 0;
  let hoverSmooth = 0;

  const resize = () => {
    renderer.setSize(root.clientWidth || 1, root.clientHeight || 1);
    program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  };
  new ResizeObserver(resize).observe(root);
  resize();

  root.addEventListener("pointermove", event => {
    const rect = root.getBoundingClientRect();
    mouseTarget[0] = Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1);
    mouseTarget[1] = Math.min(Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0), 1);
    hoverTarget = 1;
  }, { passive: true });
  root.addEventListener("pointerenter", () => { hoverTarget = 1; }, { passive: true });
  root.addEventListener("pointerleave", () => { hoverTarget = 0; }, { passive: true });

  let last = performance.now();
  let elapsed = 0;
  const draw = now => {
    const delta = Math.max(0, now - last) * 0.001;
    last = now;
    if (!settings.paused) elapsed += delta;
    const tau = 0.02 + Math.min(Math.max(settings.hoverDampness, 0), 1) * 0.5;
    const alpha = 1 - Math.exp(-delta / tau);
    mouseSmooth[0] += (mouseTarget[0] - mouseSmooth[0]) * alpha;
    mouseSmooth[1] += (mouseTarget[1] - mouseSmooth[1]) * alpha;
    hoverSmooth += (hoverTarget - hoverSmooth) * alpha;
    program.uniforms.uMouse.value = mouseSmooth;
    program.uniforms.uHoverActive.value = hoverSmooth;
    program.uniforms.uTime.value = elapsed;
    renderer.render({ scene: mesh });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
</script>`;
}
