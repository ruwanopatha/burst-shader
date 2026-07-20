"use client";

import { useMemo, useState } from "react";
import PrismaticBurst, { type AnimationType } from "./PrismaticBurst";
import { createWebflowEmbed } from "./webflowExport";

type Settings = {
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

const defaults: Settings = {
  intensity: 2,
  speed: 0.5,
  animationType: "rotate3d",
  colors: ["#daca24", "#fff266", "#bababa"],
  distort: 0,
  hoverDampness: 0.25,
  hoverDisplacement: 1,
  rayCount: 0,
  paused: false,
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (next) => next.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <label className="range-control">
      <span className="control-label">
        <span>{label}</span>
        <output>{format(value)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [panelOpen, setPanelOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy embed code");
  const colors = useMemo(() => settings.colors, [settings.colors]);
  const embedCode = useMemo(() => createWebflowEmbed(settings), [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateColor = (index: number, value: string) => {
    setSettings((current) => ({
      ...current,
      colors: current.colors.map((color, colorIndex) =>
        colorIndex === index ? value : color,
      ),
    }));
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopyLabel("Copied to clipboard");
      window.setTimeout(() => setCopyLabel("Copy embed code"), 1800);
    } catch {
      setCopyLabel("Select and copy below");
    }
  };

  return (
    <main className="studio-shell">
      <div className="shader-stage" aria-label="Interactive prismatic burst shader">
        <PrismaticBurst
          intensity={settings.intensity}
          speed={settings.speed}
          animationType={settings.animationType}
          colors={colors}
          distort={settings.distort}
          hoverDampness={settings.hoverDampness}
          hoverDisplacement={settings.hoverDisplacement}
          rayCount={settings.rayCount}
          paused={settings.paused}
          mixBlendMode="lighten"
        />
      </div>

      <header className="studio-header">
        <button
          className="panel-toggle"
          type="button"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          {panelOpen ? "Hide controls" : "Controls"}
        </button>
      </header>

      {panelOpen && (
        <aside className="controls-panel" aria-label="Shader controls">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">Live controls</span>
              <h2>Prismatic Burst</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close controls"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>

          <RangeControl
            label="Intensity"
            value={settings.intensity}
            min={0.1}
            max={4}
            step={0.05}
            onChange={(value) => update("intensity", value)}
          />
          <RangeControl
            label="Speed"
            value={settings.speed}
            min={0}
            max={2}
            step={0.05}
            onChange={(value) => update("speed", value)}
          />

          <label className="select-control">
            <span className="control-label">Animation type</span>
            <select
              value={settings.animationType}
              onChange={(event) =>
                update("animationType", event.target.value as AnimationType)
              }
            >
              <option value="rotate3d">Rotate 3D</option>
              <option value="rotate">Rotate</option>
              <option value="hover">Hover</option>
            </select>
          </label>

          <fieldset className="color-controls">
            <legend>Colors</legend>
            {settings.colors.map((color, index) => (
              <div className="color-row" key={`${index}-${settings.colors.length}`}>
                <input
                  className="color-swatch"
                  type="color"
                  aria-label={`Color ${index + 1}`}
                  value={color}
                  onChange={(event) => updateColor(index, event.target.value)}
                />
                <input
                  className="hex-input"
                  type="text"
                  aria-label={`Color ${index + 1} hex value`}
                  value={color}
                  maxLength={7}
                  onChange={(event) => updateColor(index, event.target.value)}
                />
                <button
                  className="remove-color"
                  type="button"
                  aria-label={`Remove color ${index + 1}`}
                  disabled={settings.colors.length <= 1}
                  onClick={() =>
                    update(
                      "colors",
                      settings.colors.filter((_, colorIndex) => colorIndex !== index),
                    )
                  }
                >
                  −
                </button>
              </div>
            ))}
            <button
              className="add-color"
              type="button"
              disabled={settings.colors.length >= 8}
              onClick={() => update("colors", [...settings.colors, "#ffffff"])}
            >
              + Add color
            </button>
          </fieldset>

          <RangeControl
            label="Distort"
            value={settings.distort}
            min={0}
            max={10}
            step={0.1}
            onChange={(value) => update("distort", value)}
          />
          <RangeControl
            label="Hover dampness"
            value={settings.hoverDampness}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => update("hoverDampness", value)}
          />
          <RangeControl
            label="Hover displacement"
            value={settings.hoverDisplacement}
            min={0}
            max={2}
            step={0.01}
            onChange={(value) => update("hoverDisplacement", value)}
          />
          <RangeControl
            label="Ray count"
            value={settings.rayCount}
            min={0}
            max={32}
            step={1}
            format={(value) => String(value)}
            onChange={(value) => update("rayCount", value)}
          />

          <div className="panel-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => update("paused", !settings.paused)}
            >
              {settings.paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setSettings(defaults)}
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            className="export-button"
            onClick={() => setExportOpen(true)}
          >
            Export Code
          </button>
          <p className="hover-note">Move across the canvas to softly bend the burst.</p>
        </aside>
      )}

      {exportOpen && (
        <div className="export-backdrop" role="presentation" onMouseDown={() => setExportOpen(false)}>
          <section
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Webflow embed</span>
                <h2 id="export-title">Ready-to-paste code</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close code export"
                onClick={() => setExportOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="export-instructions">
              Add an Embed element in Webflow, paste this code, then set the parent element to your preferred height.
            </p>
            <textarea
              className="export-code"
              aria-label="Webflow embed code"
              readOnly
              spellCheck={false}
              value={embedCode}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button className="primary-button copy-button" type="button" onClick={copyEmbed}>
              {copyLabel}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
