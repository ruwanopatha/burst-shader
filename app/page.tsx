"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

type ShaderSettings = {
  density: number;
  seed: number;
  color: string;
  speed: number;
};

type PointerState = {
  active: number;
  x: number;
  y: number;
};

const minSeed = 10000;
const maxSeed = 99999;

const defaultSettings: ShaderSettings = {
  density: 62,
  seed: 12070,
  color: "#7e87a8",
  speed: 0.8,
};

const vertexShaderSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_density;
uniform float u_seed;
uniform vec3 u_color;
uniform vec2 u_pointer;
uniform float u_pointer_active;
uniform float u_speed;

float normalizedSeed() {
  return mod(u_seed, 100000.0) / 100000.0;
}

float hash(vec2 point) {
  float seed = normalizedSeed();
  vec2 seeded = point + vec2(seed * 997.31, seed * 431.73);
  return fract(sin(dot(seeded, vec2(127.1, 311.7))) * 43758.5453123);
}

float seedValue(float value) {
  return hash(vec2(value, value * 7.137));
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float waveField(vec2 cell, vec2 normalizedCell, float time, out float depth) {
  vec2 p1 = vec2(seedValue(1.0), seedValue(2.0));
  vec2 p2 = vec2(seedValue(9.0), seedValue(5.0));
  vec2 p3 = vec2(seedValue(15.0), seedValue(21.0));
  vec2 p4 = vec2(seedValue(31.0), seedValue(42.0));
  vec2 rotatedCell = rotate2d(seedValue(33.0) * 6.2831) * cell;

  float diagonalFrequency = mix(0.18, 0.58, seedValue(12.0));
  float diagonal = sin(
    rotatedCell.x * diagonalFrequency +
    rotatedCell.y * mix(0.18, 0.48, seedValue(14.0)) +
    time * mix(0.75, 1.95, seedValue(18.0))
  );
  float radialA = sin(
    distance(normalizedCell, p1) * mix(15.0, 42.0, seedValue(22.0)) -
    time * mix(1.2, 3.6, seedValue(25.0))
  );
  float radialB = cos(
    distance(normalizedCell, p2) * mix(17.0, 54.0, seedValue(28.0)) +
    time * mix(0.9, 2.8, seedValue(29.0))
  );
  float fold = sin(
    (rotatedCell.x * p3.x - rotatedCell.y * p3.y) * mix(0.12, 0.44, seedValue(36.0)) +
    time * mix(0.65, 1.7, seedValue(40.0))
  );
  float ridge = cos(distance(normalizedCell, p4) * mix(24.0, 72.0, seedValue(45.0)) - time);

  float field = diagonal * 0.3 + radialA * 0.26 + radialB * 0.22 + fold * 0.16 + ridge * 0.06;
  depth = smoothstep(-0.92, 0.95, field);

  return field;
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  vec2 aspect = u_resolution / min(u_resolution.x, u_resolution.y);
  vec2 centered = (st - 0.5) * aspect;
  float time = u_time * u_speed;
  vec2 pointerDelta = (st - u_pointer) * aspect;
  float pointerDistance = length(pointerDelta);
  vec2 pointerDir = normalize(pointerDelta + vec2(0.0001));
  vec2 pointerSwirl = vec2(-pointerDir.y, pointerDir.x);

  // A soft, asymmetric liquid lens. The two angular bands keep the hover
  // response organic instead of reading as a circular ripple.
  float pointerAngle = atan(pointerDelta.y, pointerDelta.x);
  float falloffWobble = 0.86
    + 0.13 * sin(pointerAngle * 3.0 + time * 0.42)
    + 0.08 * sin(pointerAngle * 5.0 - time * 0.31);
  float hover = u_pointer_active *
    (1.0 - smoothstep(0.035, 0.47 * falloffWobble, pointerDistance));
  float liquidBand = hover * smoothstep(0.015, 0.15, pointerDistance);
  float shear = sin(pointerAngle * 2.0 - time * 0.65) * 0.5 + 0.5;
  centered += pointerSwirl * liquidBand * mix(0.008, 0.027, shear);
  centered += pointerDir * liquidBand * 0.019;

  // Keep the resting matrix orthogonal like the reference. Motion changes
  // luminance; geometry only bends inside the liquid hover lens.
  vec2 scaled = (centered + 0.5 * aspect) * u_density;
  vec2 cell = floor(scaled);
  vec2 local = fract(scaled) - 0.5;
  vec2 normalizedCell = (cell / (aspect * u_density)) + vec2(seedValue(61.0), seedValue(62.0)) * 0.18;

  float randomPhase = hash(cell);
  float depth = 0.0;
  float wave = waveField(cell + randomPhase, normalizedCell, time, depth);
  depth = clamp(depth, 0.0, 1.0);
  float waveAccent = 0.5 + 0.5 * wave;
  float pulse = 0.5 + 0.5 * sin(time * mix(1.0, 2.4, seedValue(70.0)) + randomPhase * 6.2831);
  float radius = mix(0.055, 0.115, depth);
  radius *= mix(0.92, 1.07, pulse);
  radius *= 1.0 + hover * 0.22;

  float distToCenter = length(local);
  float edgeSoftness = 0.025;
  float dotMask = 1.0 - smoothstep(radius, radius + edgeSoftness, distToCenter);

  float vignette = smoothstep(0.95, 0.25, distance(st, vec2(0.5)));
  vec3 base = vec3(0.009, 0.010, 0.013);
  vec3 dotColor = mix(u_color * 0.18, u_color * 0.62, depth);
  dotColor *= 0.58 + pulse * 0.12 + waveAccent * 0.2;
  dotColor *= mix(0.52, 1.0, vignette);

  vec3 color = mix(base, dotColor, dotMask);
  color += mix(u_color, vec3(1.0), 0.22) * dotMask * hover * 0.22;

  gl_FragColor = vec4(color, 1.0);
}
`;

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const int = Number.parseInt(value, 16);

  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("Unable to create shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    vertexShaderSource,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  );
  const program = gl.createProgram();

  if (!program) {
    throw new Error("Unable to create WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef<ShaderSettings>(defaultSettings);
  const pointerRef = useRef<PointerState>({ active: 0, x: 0.5, y: 0.5 });
  const [settings, setSettings] = useState<ShaderSettings>(defaultSettings);
  const [shaderError, setShaderError] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    const reportShaderError = (message: string) => {
      window.setTimeout(() => setShaderError(message), 0);
    };

    if (!gl) {
      reportShaderError("WebGL is not available in this browser.");
      return;
    }

    let program: WebGLProgram;

    try {
      program = createProgram(gl);
    } catch (error) {
      reportShaderError(
        error instanceof Error ? error.message : "Shader failed.",
      );
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const densityLocation = gl.getUniformLocation(program, "u_density");
    const seedLocation = gl.getUniformLocation(program, "u_seed");
    const colorLocation = gl.getUniformLocation(program, "u_color");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const pointerActiveLocation = gl.getUniformLocation(
      program,
      "u_pointer_active",
    );
    const speedLocation = gl.getUniformLocation(program, "u_speed");
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    let frameId = 0;
    const startedAt = performance.now();

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * pixelRatio);
      const height = Math.floor(window.innerHeight * pixelRatio);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    };

    const smoothedPointer: PointerState = { ...pointerRef.current };

    const render = (now: number) => {
      resize();

      const current = settingsRef.current;
      const targetPointer = pointerRef.current;
      smoothedPointer.x += (targetPointer.x - smoothedPointer.x) * 0.14;
      smoothedPointer.y += (targetPointer.y - smoothedPointer.y) * 0.14;
      smoothedPointer.active +=
        (targetPointer.active - smoothedPointer.active) * 0.1;
      const rgb = hexToRgb(current.color);

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, (now - startedAt) / 1000);
      gl.uniform1f(densityLocation, current.density);
      gl.uniform1f(seedLocation, current.seed);
      gl.uniform3f(colorLocation, rgb.r, rgb.g, rgb.b);
      gl.uniform2f(pointerLocation, smoothedPointer.x, smoothedPointer.y);
      gl.uniform1f(pointerActiveLocation, smoothedPointer.active);
      gl.uniform1f(speedLocation, current.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    const updatePointer = (event: PointerEvent) => {
      pointerRef.current = {
        active: 1,
        x: event.clientX / window.innerWidth,
        y: 1 - event.clientY / window.innerHeight,
      };
    };
    const deactivatePointer = () => {
      pointerRef.current = { ...pointerRef.current, active: 0 };
    };

    window.addEventListener("pointermove", updatePointer);
    window.addEventListener("pointerleave", deactivatePointer);
    window.addEventListener("blur", deactivatePointer);

    return () => {
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", deactivatePointer);
      window.removeEventListener("blur", deactivatePointer);
    };
  }, []);

  const updateSetting = <Key extends keyof ShaderSettings>(
    key: Key,
    value: ShaderSettings[Key],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const randomizeSeed = () => {
    setSettings((current) => {
      const range = maxSeed - minSeed + 1;
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      const nextSeed = minSeed + (values[0] % range);

      return {
        ...current,
        seed:
          nextSeed === current.seed
            ? minSeed + ((nextSeed + 7919) % range)
            : nextSeed,
      };
    });
  };

  const exportShader = () => {
    const exportSource = `// Dot Matrix Wave fragment shader
// Exported settings:
// u_density: ${settings.density.toFixed(1)}
// u_seed: ${settings.seed.toFixed(1)}
// u_speed: ${settings.speed.toFixed(2)}
// u_color: ${settings.color}

${fragmentShaderSource.trim()}
`;
    const blob = new Blob([exportSource], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "dot-matrix-wave.frag.glsl";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className="shader-tool"
      style={{ "--accent": settings.color } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        aria-label="Animated dot matrix wave shader"
        className="shader-canvas"
      />

      {panelVisible ? (
        <section
          className="control-panel"
          id="shader-controls"
          aria-label="Shader controls"
        >
          <div className="panel-header">
            <div className="panel-heading">
              <p>Dot Matrix Wave</p>
              <span>WebGL shader tool</span>
            </div>
            <button
              aria-controls="shader-controls"
              aria-expanded="true"
              className="panel-toggle panel-toggle-inline"
              type="button"
              onClick={() => setPanelVisible(false)}
            >
              Hide
            </button>
          </div>

          <label className="control-row">
          <span>
            Density
            <strong>{settings.density}</strong>
          </span>
          <input
            min="18"
            max="240"
            step="1"
            type="range"
            value={settings.density}
            onChange={(event) =>
              updateSetting("density", Number(event.target.value))
            }
          />
          </label>

          <label className="control-row">
          <span>
            Speed
            <strong>{settings.speed.toFixed(2)}x</strong>
          </span>
          <input
            min="0"
            max="3"
            step="0.05"
            type="range"
            value={settings.speed}
            onChange={(event) =>
              updateSetting("speed", Number(event.target.value))
            }
          />
          </label>

          <div className="split-controls">
          <div className="seed-display">
            <span>Seed</span>
            <strong>{settings.seed}</strong>
          </div>
          <button type="button" onClick={randomizeSeed}>
            New seed
          </button>
          </div>

          <label className="color-field">
          <span>
            Shader colour
            <strong>{settings.color.toUpperCase()}</strong>
          </span>
          <span className="color-picker-shell">
            <input
              aria-label="Choose shader colour"
              type="color"
              value={settings.color}
              onChange={(event) => updateSetting("color", event.target.value)}
            />
          </span>
          </label>

          <button
            className="export-button"
            type="button"
            onClick={exportShader}
          >
            Export GLSL
          </button>

          {shaderError ? <p className="shader-error">{shaderError}</p> : null}
        </section>
      ) : (
        <button
          aria-controls="shader-controls"
          aria-expanded="false"
          className="panel-toggle panel-toggle-floating"
          type="button"
          onClick={() => setPanelVisible(true)}
        >
          Show controls
        </button>
      )}
    </main>
  );
}
