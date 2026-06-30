# Dot Matrix Wave Shader

A full-viewport WebGL shader tool for generating animated dot matrix wave
fields with live controls.

## Controls

- Density adjusts the number of dot cells in the matrix.
- Seed displays the current five-digit procedural value.
- New seed generates a fresh five-digit matrix animation variant.
- Shader colour updates the dot and mesh glow colour.
- Speed controls animation time scaling.
- Cursor hover pushes and brightens the nearby wave field.

## Shader Notes

The implementation follows core patterns from
[The Book of Shaders](https://thebookofshaders.com/):

- normalized fragment coordinates from `gl_FragCoord / u_resolution`
- `u_time` and `u_resolution` uniforms for responsive animation
- tiled coordinate space for the matrix grid
- deterministic pseudo-random values for seeded cell variation
- seeded camera tilt, perspective projection, and depth shading
- cursor-driven uniforms for hover ripples and local distortion
- layered sine and radial waves for procedural motion

## Run Locally

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000/`.

## Validate

```bash
npm run build
```
