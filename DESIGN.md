---
name: SOU MANA.GER Barber
description: Sistema operacional premium para barbearias, com gestao real, rotina acolhedora e assinatura SMG tech.
colors:
  primary-gold: "#D99A2B"
  primary-gold-hover: "#A96F14"
  primary-gold-light: "#F3D9A4"
  success-green: "#178A50"
  danger-red: "#C92A2A"
  gold-soft: "#F7E7C2"
  gold-pale: "#FCF6E7"
  cream: "#FAF6EE"
  card: "#FFFFFF"
  ink: "#191611"
  ink-soft: "#6B6252"
  line: "#E8DFC9"
  night: "#0B0B0C"
  smg-ink: "#14110B"
  smg-deep: "#231A06"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "linear-gradient(to right, #E8B04B, #C98A1F)"
    textColor: "{colors.night}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.primary-gold-hover}"
    textColor: "{colors.night}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card-boutique:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: SOU MANA.GER Barber

## 1. Overview

**Creative North Star: "The Smart Barber Atelier"**

The SOU MANA.GER interface is a working atelier for barbershop management: precise enough for finance and command flows, warm enough for daily use at the counter, and branded enough to feel unmistakably SMG. The system runs on a light cream base with a single gold as the brand voice. There is no accent blue: gold carries brand and navigation, while green and red are reserved strictly for semantic status and chart series.

This is a product interface, not a marketing stage. Density is allowed because owners and managers need agenda, comandas, cash flow, team status, recurring memberships and real indicators in one operational rhythm. The UI should feel premium through alignment, spacing, hierarchy and state clarity, never through decorative effects that slow the task down.

It explicitly rejects generic ERP behavior, generic SaaS dashboards, fake metrics, and barber-agnostic screens. Every new screen should prove it belongs to a barbershop through its data, workflows and vocabulary.

**Key Characteristics:**
- Dense but calm product surfaces for real work.
- Cream warmth from gold, ivory and ink — light is the default theme.
- Gold reserved for brand voice, primary actions and active navigation.
- Clear states for agenda, payment, finance, support and recurring memberships.
- Real data, honest empty states and actionable errors.

## 2. Colors

The palette is barber-first and single-accent: one gold carries the brand across light surfaces. Blue is removed from the design system entirely — decorative or operational. Green and red are semantic only.

### Primary
- **Gold** (`#D99A2B`): The brand and operational primary. Use for primary actions, active navigation, notification badges, focus rings and selected states. Its role is directional, not decorative.
- **Gold Dark** (`#A96F14`): The pressed/hover tone, and gold text on light surfaces where contrast must hold AA.
- **Gold Light** (`#F3D9A4`): A light highlight for subtle borders, icons and small accents. Use sparingly so premium does not become noisy.

### Surfaces
- **Cream** (`#FAF6EE`): The light app base and page background. Warmer than white, softer over long sessions.
- **Card** (`#FFFFFF`): Cards, modals, tables and inputs.
- **Line** (`#E8DFC9`): Hairline borders, dividers and table rules. Borders come before shadows.
- **Gold Soft** (`#F7E7C2`) and **Gold Pale** (`#FCF6E7`): Subtle gold-tinted tile and header washes for icon tiles, table headers and quiet emphasis.

### Text
- **Ink** (`#191611`): Strong light-mode text and headings.
- **Ink Soft** (`#6B6252`): Secondary text, helper copy, metadata and inactive icons.
- **Night** (`#0B0B0C`): Text on gold buttons and pills, where gold is the background.

### Semantic (status and charts only)
- **Success Green** (`#178A50`): Positive financial movement, completed states and successful settlement.
- **Danger Red** (`#C92A2A`): Blocking, destructive or failed states.
- **Warning Amber**: Due soon, attention, inventory or operational warning — light tints only.

### Corporate
- **SMG Ink** (`#14110B`) and **SMG Deep** (`#231A06`): Dark corporate-brand surfaces outside the operational product. Names retained from the previous system; values warmed to the new identity.

### Dark mode

Dark mode remains available but is no longer the default. It uses warm dark surfaces (`#1A1610` cards, `#2D2618` borders) — never navy. `.theme-estetica` (kiosk) overrides the palette for its own skin and is out of scope for this identity.

### Named Rules

**The Real Signal Rule.** Color must communicate state, hierarchy or brand. Do not spend accent color on decoration.

**The Single Gold Rule.** Gold is the only brand and navigation color. Blue is removed from the system: never reintroduce a decorative or operational blue. Green and red are semantic only (status, charts), never brand voice.

**The CTA Gradient Rule.** The gold gradient (`#E8B04B → #C98A1F` with night text) is for buttons only. Never use it on cards, tiles or page backgrounds.

## 3. Typography

**Display Font:** Outfit, sans-serif
**Body Font:** Plus Jakarta Sans, sans-serif
**Label/Mono Font:** No mono family is currently established.

**Character:** Outfit gives headings and numeric displays a boutique, high-confidence feel. Plus Jakarta Sans keeps dense product text readable, modern and calm across tables, forms, cards and filters.

### Hierarchy
- **Display** (800, 1.875rem, 1.15): Use for page titles, major dashboard headings and large numeric emphasis. Keep it out of routine form labels.
- **Headline** (700, 1.5rem, 1.2): Use for section-level headings and modal titles.
- **Title** (700, 1.125rem, 1.25): Use for card headings, panel titles and grouped controls.
- **Body** (500, 0.875rem, 1.5): Use for default UI copy, rows, descriptions and operational text. Keep prose near 65 to 75 characters where it reads as paragraphs.
- **Label** (700, 0.6875rem, 0.16em, uppercase): Use for metadata, table/category labels, filter captions and compact status descriptors.

### Named Rules

**The Product Legibility Rule.** Display type is for orientation and high-value numbers only. Labels, buttons, inputs and table rows stay compact and readable.

## 4. Elevation

The system uses a hybrid of tonal layering, borders and soft shadows. Light mode is the base: cream surfaces, hairline gold-tinted borders and subtle warm ambient shadows. Dark mode, when enabled, uses warm dark layering and border contrast first, with heavier shadows reserved for modal overlays and elevated panels.

### Shadow Vocabulary
- **SMG Shell** (`box-shadow: 0 12px 32px rgba(61, 42, 8, 0.08)` → `--shadow-smg-shell`): Default card and panel elevation in light mode.
- **SMG Glow** (`box-shadow: 0 0 28px rgba(217, 154, 43, 0.25)` → `--shadow-smg-glow`): Gold ambient glow reserved for hover and genuinely interactive elevations.
- **Modal Overlay:** Heavier warm shadow for modals and floating panels where border alone is not enough.

### Named Rules

**The Border Before Shadow Rule.** Use borders and tonal surfaces first. Add shadow only when the component is interactive, layered, floating or modal.

## 5. Components

### Buttons

Buttons are confident, compact and task-first.

- **Shape:** Gently rounded rectangles (8px for shared Button, 12px to 16px for larger app actions).
- **Primary:** Gold gradient background (`#E8B04B → #C98A1F`) with night text, bold body typography, standard padding (10px 16px). Buttons only — never on cards or tiles.
- **Hover / Focus:** Hover darkens toward Gold Dark or softens opacity. Focus should use a clear primary ring, commonly `focus:ring-2 focus:ring-primary/20`.
- **Secondary / Ghost / Tertiary:** Secondary uses cream or card surfaces with a Line border. Ghost buttons stay transparent until hover. Danger, success and warning variants use semantic color only when the action itself is semantic.

### Chips

Chips are compact state markers, not decoration.

- **Style:** Tinted semantic background, matching semantic text and a low-contrast border.
- **State:** Selected states should use the same vocabulary as active navigation: accent tint, clear text contrast and icon support when useful.

### Cards / Containers

Cards carry dense operational content without turning the whole interface into a grid of identical boxes.

- **Corner Style:** Soft boutique corners (16px to 20px).
- **Background:** Cards use Card white on a Cream page. Dark mode uses warm dark surfaces.
- **Shadow Strategy:** Resting cards use SMG Shell. Interactive cards may lift with SMG Glow.
- **Border:** Hairline Line (`#E8DFC9`) borders. Borders come before shadows.
- **Internal Padding:** Dense cards use 16px to 20px. Larger panels and modals use 24px.

### Inputs / Fields

Inputs are quiet, rectangular and predictable.

- **Style:** 40px height, 12px radius, Card surface, thin Line border and 12px horizontal padding.
- **Focus:** Border shifts to primary and adds a soft primary ring.
- **Error / Disabled:** Error must use red plus text or icon. Disabled uses opacity and cursor state, not just color.

### Navigation

Navigation is an app-shell pattern with a left sidebar, a top utility bar and a mobile bottom nav on operational routes. The desktop sidebar is Card white with a gold active pill and night text; collapsed sidebar items expose tooltips. The mobile bottom bar keeps the same items and role rules as before, restyled in place with a gold active indicator. Mobile routes keep core actions reachable without hiding them behind the desktop sidebar model.

### Signature Component: MetricCard

Financial and operational KPI cards are rendered by the single `components/ui/MetricCard.tsx` primitive (ADR-031): label, icon tile, value, trend chip and optional progress. Tone maps are semantic — positive, negative and neutral — with the gold family for neutral/attention. Never invent values for these cards; show real data, a loading/skeleton state, an honest empty state or an actionable error.

## 6. Do's and Don'ts

### Do:

- **Do** preserve the product register: dense, predictable surfaces for owners, managers, receptionists and professionals.
- **Do** use gold for primary product actions and active navigation; use green and red only for semantic status and chart series.
- **Do** make barber-specific workflows visible: agenda, chair, professional, client, comanda, checkout, membership and recurrence.
- **Do** show real data when a real source exists; otherwise show an honest empty state or actionable error.
- **Do** keep focus states, hover states and disabled states explicit on every interactive component.
- **Do** use semantic colors for finance and operations, and pair color with icons, labels or text.

### Don't:

- **Don't** make the app look like a generic ERP, bureaucratic back office or cold accounting system.
- **Don't** make it look like a generic SaaS dashboard with repeated cards, decorative metrics and market-neutral copy.
- **Don't** use fake data when real data or real query paths already exist.
- **Don't** replace barber-specific vocabulary with generic business labels.
- **Don't** use side-stripe borders, gradient text, decorative glassmorphism or hero-metric templates.
- **Don't** reintroduce blue — decorative or operational. The design system is single-accent gold.
- **Don't** use the gold gradient on cards, tiles or page backgrounds; it is reserved for buttons.
- **Don't** use saturated gold, red or green as decoration on inactive states.
