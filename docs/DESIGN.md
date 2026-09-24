# Design system — Lattice

Composition Protocol UI follows the **Lattice** style reference: botanical field journal on warm parchment.

**Locked direction:** Parchment canvas `#f7f6f2` · Forest Ink `#001f1f` primary text/CTA · pastel specimen cards (mint / lime / lavender) · DM Sans as Matter substitute · 29px pill buttons · soft forest-tinted elevation.

Tokens live in [`frontend/app/globals.css`](../frontend/app/globals.css).

## Do

- Parchment page background always — never pure white body canvas
- Primary CTA = filled Forest Ink + white text; secondary = outlined Forest Ink
- Section rhythm: Category Pill → heading → description
- Pastel tints only on contained feature cards (not full-bleed sections)
- Halo radial gradient only behind the hero device frame

## Don't

- Pure black `#000`
- Colored primary buttons
- Sharp 0px corners
- Pastels on full-width page sections
- Heavy shadows

## Taxonomy (pastel homes)

| Module | Pastel |
| --- | --- |
| Propose / assets | Mint `#e4f7f9` |
| Accept / settle | Lime `#f8fbe7` |
| Observer / privacy | Lavender `#e1e1fa` |
| Metrics / evidence | Buttercream / Sage |
| BitSafe banner | Violet→teal gradient closer |
