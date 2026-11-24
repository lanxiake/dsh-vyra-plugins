---
name: open-design-vibrant
description: "OpenDesign design system — Vibrant (Bold & Expressive): Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy."
metadata:
  group: open-design-design-systems
  designSystemId: "vibrant"
  category: "Bold & Expressive"
  source: "https://github.com/nexu-io/open-design/tree/main/design-systems/vibrant"
---

# Vibrant — OpenDesign design system

> OpenDesign open-source design system `vibrant` (Apache-2.0). Brand-referencing packages are aesthetic inspirations, not official brand assets.

Use this skill when the brief names **Vibrant**, asks for the Bold & Expressive visual direction, or matches: Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy. Treat the specification below as the visual contract for this project; do not mix tokens from another design system unless the user asks.

## Specification

> Category: Bold & Expressive
> Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy.

## 1. Visual Theme & Atmosphere

Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy.

- **Visual style:** modern, clean, bold, playful
- **Color stance:** primary, secondary, neutral, success
- **Design intent:** Keep outputs recognizable to this style family while preserving usability and readability.

## 2. Color

- **Primary:** `#7C61D4` — Token from style foundations.
- **Secondary:** `#EAAE87` — Token from style foundations.
- **Success:** `#16A34A` — Token from style foundations.
- **Warning:** `#D97706` — Token from style foundations.
- **Danger:** `#DC2626` — Token from style foundations.
- **Surface:** `#FFFFFF` — Token from style foundations.
- **Text:** `#2F281D` — Token from style foundations.
- **Neutral:** `#FFFFFF` — Derived from the surface token for official format compatibility.

- Favor Primary (#7C61D4) for CTA emphasis.
- Use Surface (#FFFFFF) for large backgrounds and cards.
- Keep body copy on Text (#2F281D) for legibility.

## 3. Typography

- **Scale:** 14/16/18/24/32/40
- **Families:** primary=Noto Sans, display=Fascinate, mono=Fira Code
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## 4. Spacing & Grid

- **Spacing scale:** 2/4/8/12/16/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## 5. Layout & Composition

- Prefer clear content blocks with consistent internal padding.
- Keep hierarchy obvious: headline → support text → primary action.
- Use whitespace to separate concerns before adding borders or shadows.

## 6. Components

- Buttons: primary action uses `#7C61D4`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## 7. Motion & Interaction

- Use subtle transitions that emphasize Primary (#7C61D4) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.

## 8. Voice & Brand

- Tone should reflect the visual style: concise, confident, and product-specific.
- Keep microcopy action-oriented and avoid generic filler language.
- Preserve the style identity in headlines while keeping UI labels literal and clear.

## 9. Anti-patterns

- Do not introduce off-palette colors when an existing token can solve the problem.
- Do not flatten hierarchy by using the same type size/weight for all text.
- Do not add decorative effects that reduce readability or accessibility.
- Do not mix unrelated visual metaphors in the same interface.

## Source

- https://github.com/nexu-io/open-design/tree/main/design-systems/vibrant
- Canonical files: `DESIGN.md`, `tokens.css`, `manifest.json`
