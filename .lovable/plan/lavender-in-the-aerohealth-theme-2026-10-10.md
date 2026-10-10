# Lavender in the AeroHealth theme

Yes — the whole look is driven by color tokens in one stylesheet, so purple can be added without touching layout or logic.

## What you'll see

A soft lavender sky: the page background shifts from violet at the top through aqua to the green horizon, so the site keeps its fresh Frutiger Aero feel but reads more violet. Purple then marks the provider side and a few highlights, while your main green "Create new log" button and aqua actions stay as they are.

## How purple shows up

**Landing page**
- A lavender tint washes over the hero photo (sky and bubbles go periwinkle; the green grass stays vivid rather than muddy).
- The headline word "prepared." turns violet.
- "I'm a provider" becomes a glossy violet pill; "Create free account" stays aqua.
- Feature-card icons alternate aqua and violet, and a few violet bubbles float behind the glass panel.

**Top bar**
- The account-type chip reads violet for providers, stays pale blue for patients.

**Sign in / sign up**
- The Provider option, when selected, highlights violet; Patient stays blue.
- The "Create an account" / "Sign in" switch link turns violet.

**Patient dashboard**
- Green "Create new log" button and log cards unchanged.

**Provider workspace**
- The workspace header gets a violet glass band and violet heading accent.
- Shared-log cards carry a thin violet top rule; the "Nothing shared yet" icon turns violet.

**Log page**
- Section headings inside the log turn violet to match the PDF.
- "Download PDF" stays aqua, "Share" stays green.

**Shared PDFs**
- The top banner and every section heading become violet; the divider line turns pale lavender.
- Body text stays near-black on white so it prints and photocopies cleanly.

## Technical details

**`src/styles.css`** — new tokens in `:root` plus matching entries in `@theme inline`:
- `--lilac: oklch(0.55 0.19 292)`, `--lilac-glow: oklch(0.78 0.13 300)`, `--lilac-soft: oklch(0.94 0.035 295)`, `--lilac-foreground: oklch(0.99 0 0)`
- `--gradient-lilac` (glossy violet, same highlight/split pattern as the existing aqua and green gradients)
- `--gradient-sky` retuned: violet at the top → aqua mid → green at the horizon
- `--chart-5` retuned to the new violet so charts stay consistent

New `@utility` rules: `gloss-lilac` (mirrors `gloss-aqua`), `hero-lilac-tint` (a `mix-blend-mode: soft-light` violet overlay used on the hero image so saturated greens aren't flattened), `bubble-lilac` (translucent violet bubble).

**`src/components/ui/button.tsx`** — add a `lilac` variant using `gloss-lilac`.

**Routes touched** — `index.tsx` (hero tint overlay, headline accent, provider CTA, icon alternation, bubbles), `auth.tsx` (provider option + switch link), `_authenticated.dashboard.tsx` (provider band, heading, card rule, empty-state icon), `_authenticated.logs.$id.tsx` (section headings violet), `AppHeader.tsx` (provider chip).

**`src/lib/pdf.ts`** — banner fill moves from blue `(30,120,200)` to violet, section-heading text color to violet, divider line to pale lavender; body text and footer gray unchanged.

No database, auth, or routing changes. All colors come from tokens — no hardcoded values in components.

## Verification

- Check the build log after the edits.
- Drive the preview in a browser at 1280x1800 and screenshot: landing page, sign-up with Provider selected, patient dashboard, provider dashboard, one log page — confirming purple reads as intended in each.
- Download a PDF from a log page and confirm the banner and section headings render violet with dark body text.
