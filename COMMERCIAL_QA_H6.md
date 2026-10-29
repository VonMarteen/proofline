# PROOFLINE — H6 Commercial Closure & QA

## Scope
Final local closure of the public commercial surface. No new product capability is introduced.

## Routes covered
- Home
- Product
- Solutions
- Frameworks / Library
- Trust
- Start
- Demo / Contact
- Legal / Cookies consistency

## Visual rules frozen
- No decorative micro-subtitles where the main heading already explains the section.
- Secondary-page H1/H2 sizes stay within the H6 compact enterprise scale.
- Cards use content-driven height; no giant empty panels.
- Trust evidence is consolidated once, not repeated on every principle.
- Start/Demo forms are compact, readable and honest about unavailable external payment rails.
- The Home final CTA uses the supplied signal-network artwork across the full banner.
- Light/dark and responsive behavior remain inherited from the shared product tokens.

## QA command
```bash
pnpm site:qa
```

## Release gate
Run, in order:
```bash
pnpm site:qa
pnpm email:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

H6 is considered closed only if those commands are green and the public pages pass a visual smoke test in desktop/tablet/mobile plus light/dark.
