# PIMIS Brand Kit

Source of truth for PIMIS's visual identity. This formalizes tokens that
already existed in `src/styles.css` and were partially applied — this doc
makes them the single reference so future UI work stays consistent instead
of reaching for raw Tailwind colors (`amber-100`, `sky-600`, etc.).

**Rule: never use a raw Tailwind color utility (`bg-emerald-100`,
`text-rose-700`, ...) in application code.** Always use a semantic token
below. If a new status/meaning doesn't fit an existing token, add one to
`styles.css` first (see "Adding a new token").

## Color tokens

All colors are OKLCH, defined in `:root` in `src/styles.css`, exposed as
Tailwind utilities via `@theme inline` (e.g. `--success` → `bg-success`,
`text-success`, `border-success`).

| Token | Use for | Tailwind classes |
|---|---|---|
| `primary` | Brand actions, links, focus rings | `bg-primary`, `text-primary` |
| `success` / `success-soft` | Healthy stock, completed, positive trend | `bg-success-soft text-success` |
| `warning` / `warning-soft` | Low stock, pending review, needs attention | `bg-warning-soft text-warning` |
| `danger` / `danger-soft` | Errors, low-stock badges (less severe than critical) | `bg-danger-soft text-danger` |
| `critical` / `critical-soft` | Critical stock, urgent/destructive emphasis | `bg-critical-soft text-critical` |
| `info` / `info-soft` | Overstock, informational/neutral-positive callouts (trust blue) | `bg-info-soft text-info` |
| `ai` / `ai-soft` | AI-generated content markers (draft AI, AI summary panels) | `bg-ai-soft text-ai` |
| `gold` / `gold-soft` | Accent highlights, active sidebar indicator | `bg-gold` |
| `sidebar*` | Sidebar-only surface, always dark regardless of app theme | `bg-sidebar`, `text-sidebar-foreground` |

Neutral text/surface — never hardcode grays:

| Token | Use for |
|---|---|
| `foreground` | Primary body/heading text |
| `muted-foreground` | Secondary/caption text |
| `muted` | Subtle fills (empty bars, disabled backgrounds) |
| `border` / `border-strong` | Default and emphasized borders |
| `surface` / `card` | Elevated panel backgrounds |

### Adding a new token

1. Pick the closest existing semantic meaning first — most new needs map to
   `success`/`warning`/`danger`/`critical`/`info`/`ai`.
2. Only add a new token when the meaning is genuinely distinct and will
   recur (3+ places). One-off decorative color does not need a token.
3. Follow the existing pattern: base + `-foreground` + `-soft`, OKLCH,
   registered in both `:root` and `@theme inline`.

## Typography

- **Sans (UI/body):** Inter — `font-sans`
- **Mono (SKU codes, numeric-heavy):** JetBrains Mono — `font-mono`
- Numeric/tabular data (stock counts, prices) always gets `tabular-nums` to
  avoid column jitter.

## Motion

Single rhythm, defined in `src/lib/motion.ts` (framer-motion) and mirrored
as CSS custom properties in `styles.css`:

| Token | Value | Use for |
|---|---|---|
| `DURATION.fast` / `--duration-fast` | 150ms | Button/press feedback |
| `DURATION.base` / `--duration-base` | 220ms | Hover states, small transitions |
| `DURATION.slow` / `--duration-slow` | 420ms | Page transitions, card entrances |
| `EASE_OUT` | cubic-bezier(0.2, 0.8, 0.2, 1) | Entering elements |
| `EASE_SPRING` | cubic-bezier(0.17, 0.67, 0.24, 0.99) | Exits, playful emphasis |
| `STAGGER_STEP` | 45ms | Delay between list/grid item entrances |

Shared variants — import from `@/lib/motion` rather than writing new
`transition`/`variants` objects inline:

- `fadeInUp` — single element entrance
- `staggerContainer` + `listItem` — list/grid of cards or rows
- `pagePresence` — route-level enter/exit (used once, in `Layout.tsx`)

**Reduced motion is handled automatically** — the whole app is wrapped in
`<MotionConfig reducedMotion="user">` (see `routes/__root.tsx`), and
`styles.css` has a global `@media (prefers-reduced-motion: reduce)` override
for CSS-only animations. Don't add a manual reduced-motion check per
component; the two global mechanisms already cover it.

Every interactive element that isn't already inside a motion-wrapped list
should still get *some* press/hover feedback:
- Buttons: handled globally by `buttonVariants` in `ui/button.tsx`
  (`active:scale-[0.97]`, disabled via `motion-reduce:active:scale-100`).
- Custom clickable cards/rows: use the `.press-feedback` utility class or a
  `motion.div`/`motion.button` with `whileTap={{ scale: 0.97 }}`.

## Spacing & radius

- Radius scale derives from `--radius: 0.5rem` via `--radius-sm/md/lg/xl/2xl`
  in `@theme inline` — use `rounded-lg`/`rounded-xl`/`rounded-2xl`, don't
  hardcode `rounded-[Npx]` unless there's no scale value close enough.
- Card/section padding follows Tailwind's default spacing scale (4px steps);
  dashboard cards commonly use `p-3`–`p-6` depending on density.

## Do / Don't

| Do | Don't |
|---|---|
| `bg-warning-soft text-warning` for a low-stock badge | `bg-amber-100 text-amber-700` |
| `text-muted-foreground` for secondary text | `text-slate-500` |
| Import `listItem`/`staggerContainer` from `@/lib/motion` for list entrances | Write a new inline `transition={{...}}` per component |
| Wrap route content once in `Layout.tsx` for page transitions | Add a page-transition animation inside individual page components |
| Add `motion-reduce:` / rely on `MotionConfig` | Ship an animation with no reduced-motion fallback |
