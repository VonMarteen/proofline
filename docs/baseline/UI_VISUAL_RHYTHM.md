# PROOFLINE UI visual rhythm

## 20px sibling-container rule

From C2.3.3 onward, **20px is the default exact separation between independent sibling containers**. It is no longer interpreted as merely a minimum.

This applies across the public/commercial site, login/activation, Workspace, Control, Support, Respond, modals, cards, panels, section grids, form blocks and table containers.

The shared token is `--space-container: 20px` in `packages/design-tokens/base.css`. `--space-section` also resolves to 20px for normal sibling content flow.

Larger whitespace is allowed only as explicit outer page/section padding or for a documented layout reason; it must not arise from arbitrary inherited `gap`, `margin` or component-specific values.

The rule does **not** mean 20px between tightly related inline/internal elements. Icon-to-text, label-to-input, badge internals and heading-to-supporting-copy may use smaller semantic spacing.

## Typography rule

Decorative micro-eyebrows, numbered filler and mini-subtitles are not used to occupy empty space. Small text is reserved for genuine metadata, status, provenance, helper or legal information.

Headings and body copy must never collide. Multi-line headings use safe line-height and copy blocks have explicit typographic spacing.

## Tables

Table headers own an explicit vertical area and never visually share space with the first data row. Header and body rows require readable line-height and vertical padding.

## Regression rule

When a screen looks too open or too dense, first inspect the parent layout contract. Do not compensate by adding one-off margins to individual children.
