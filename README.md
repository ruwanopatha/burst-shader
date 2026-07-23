# Prismatic Burst Shader

An interactive, full-viewport WebGL prismatic burst inspired by the React Bits
background effect. It includes live customization controls, subtle pointer
movement, and a ready-to-paste Webflow code export.

The renderer caps pixel density and frame rate, pauses GPU work when idle or
off-screen, and uses a reduced ray-march path for production-friendly performance.

## Controls

- Intensity and animation speed
- Rotate, Rotate 3D, and Hover animation modes
- Editable multi-stop color gradient
- Ray distortion and discrete ray count
- Hover dampness and movement strength
- Pause and reset actions

## Webflow Export

Choose **Export Code** in the controls. The generated Embed snippet
captures the current settings and includes the complete shader and pointer
interaction. Paste it into a Webflow Embed element and set the parent element
to the desired height.

## Run Locally

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000/`.

## Build

```bash
npm run build
```
