---
name: SOU MANA.GER Barber
description: Sistema operacional premium para barbearias, com gestao real, rotina acolhedora e assinatura SMG tech.
colors:
  primary-boutique-gold: "#E5A158"
  primary-gold-hover: "#D97706"
  primary-gold-light: "#FDE68A"
  smg-electric-blue: "#00D2FF"
  smg-medium-blue: "#007BFF"
  smg-deep-blue: "#003366"
  success-emerald: "#10B981"
  info-sky: "#0EA5E9"
  warning-amber: "#F59E0B"
  danger-red: "#EF4444"
  action-orange: "#F97316"
  teal-service: "#14B8A6"
  background-light: "#FAFAF9"
  surface-light: "#FFFFFF"
  app-shell-light: "#F7F7F5"
  background-dark: "#0A0A0A"
  app-shell-dark: "#0F0F11"
  surface-dark: "#121212"
  card-dark: "#1A1A1A"
  border-dark: "#262626"
  text-strong: "#171717"
  text-inverse-soft: "#F5F5F5"
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
    backgroundColor: "{colors.primary-boutique-gold}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.primary-gold-hover}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input-default:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card-boutique:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: SOU MANA.GER Barber

## 1. Overview

**Creative North Star: "The Smart Barber Atelier"**

The SOU MANA.GER interface is a working atelier for barbershop management: precise enough for finance and command flows, warm enough for daily use at the counter, and branded enough to feel unmistakably SMG. The system currently uses a boutique gold accent over warm light surfaces and charcoal dark mode, while the official SMG rebrand introduces a deep tech-blue direction for stronger corporate moments.

This is a product interface, not a marketing stage. Density is allowed because owners and managers need agenda, comandas, cash flow, team status, recurring memberships and real indicators in one operational rhythm. The UI should feel premium through alignment, spacing, hierarchy and state clarity, never through decorative effects that slow the task down.

It explicitly rejects generic ERP behavior, generic SaaS dashboards, fake metrics, and barber-agnostic screens. Every new screen should prove it belongs to a barbershop through its data, workflows and vocabulary.

**Key Characteristics:**
- Dense but calm product surfaces for real work.
- Boutique warmth from gold, ivory and charcoal.
- SMG tech authority from deep blue, electric blue and strict hierarchy.
- Clear states for agenda, payment, finance, support and recurring memberships.
- Real data, honest empty states and actionable errors.

## 2. Colors

The palette is a hybrid: the current app speaks in boutique gold and warm neutrals, while the SMG brand layer brings a deep-blue technology signature for corporate and rebrand-aligned surfaces.

### Primary
- **Boutique Gold**: The current operational primary. Use for primary actions, active navigation, notification badges, focus rings and selected states. Its role is rare and directional, not decorative.
- **Aged Gold Hover**: The active or hover tone for Boutique Gold. Use when a primary control needs a warmer pressed state.
- **Soft Gold Highlight**: A light highlight for subtle borders, icons and small accents. Use sparingly so premium does not become noisy.

### Secondary
- **SMG Electric Blue**: Official innovation signal from the rebrand. Use for SMG-branded moments, splash states, brand headers and future tech-forward surfaces.
- **SMG Medium Blue**: Bridge tone for gradients, hover transitions and brand-led UI accents.
- **SMG Deep Blue**: Authority base for corporate brand surfaces, dark hero backgrounds and high-confidence presentation areas.

### Tertiary
- **Success Emerald**: Positive financial movement, completed states and successful settlement.
- **Info Sky**: Informational barber/agenda states where blue reads as clarity rather than brand.
- **Warning Amber**: Due soon, attention, inventory or operational warning.
- **Danger Red**: Blocking, destructive or failed states.
- **Action Orange**: High-energy operational state, never a replacement for primary actions.
- **Teal Service**: Service/category distinction in agenda and operational charts.

### Neutral
- **Warm Pearl Background**: The light app base. It avoids cold white and keeps long sessions softer.
- **Clean Surface**: Cards, modals and inputs in light mode.
- **Light App Shell**: Header and main app frame in light mode.
- **OLED Charcoal**: The deepest dark background. Use as the dark mode page base.
- **Dark App Shell**: Header and layout shell in dark mode.
- **Carbon Surface**: Dark secondary panels and inputs.
- **Charcoal Card**: Dark cards and modal surfaces.
- **Dark Divider**: Borders, separators and quiet structure in dark mode.
- **Near-Black Text**: Strong light-mode text.
- **Soft White Text**: Strong dark-mode text without pure white glare.

### Named Rules

**The Real Signal Rule.** Color must communicate state, hierarchy or brand. Do not spend accent color on decoration.

**The Blue Brand Layer Rule.** SMG blues are for brand authority and future rebrand alignment; do not replace every operational gold affordance until the surrounding component system is updated with it.

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

The system uses a hybrid of tonal layering, borders and soft shadows. Light mode relies on warm surfaces with subtle ambient shadows. Dark mode uses charcoal layering and border contrast first, with heavier shadows reserved for modal overlays and elevated panels.

### Shadow Vocabulary
- **Elite Rest** (`box-shadow: 0 4px 30px rgba(0, 0, 0, 0.04)`): Default boutique card elevation in light mode.
- **Elite Hover** (`box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08)`): Hover state for cards that are genuinely interactive.
- **Elite Dark** (`box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4)`): Dark-mode panel depth where border alone is not enough.
- **Financial Ambient** (`box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06)`): Dense KPI and finance cards that need readable separation without looking heavy.

### Named Rules

**The Border Before Shadow Rule.** Use borders and tonal surfaces first. Add shadow only when the component is interactive, layered, floating or modal.

## 5. Components

### Buttons

Buttons are confident, compact and task-first.

- **Shape:** Gently rounded rectangles (8px for shared Button, 12px to 16px for larger app actions).
- **Primary:** Boutique Gold background, soft white text, bold body typography, standard padding (10px 16px).
- **Hover / Focus:** Gold darkens on hover. Focus should use a clear primary ring, commonly `focus:ring-2 focus:ring-primary/20`.
- **Secondary / Ghost / Tertiary:** Secondary uses light or dark surfaces with a thin border. Ghost buttons stay transparent until hover. Danger, success and warning variants use semantic color only when the action itself is semantic.

### Chips

Chips are compact state markers, not decoration.

- **Style:** Tinted semantic background, matching semantic text and a low-contrast border.
- **State:** Selected states should use the same vocabulary as active navigation: accent tint, clear text contrast and icon support when useful.

### Cards / Containers

Cards carry dense operational content without turning the whole interface into a grid of identical boxes.

- **Corner Style:** Soft boutique corners (16px to 20px).
- **Background:** Light cards use Clean Surface. Dark cards use Charcoal Card with Dark Divider borders.
- **Shadow Strategy:** Resting cards use low ambient shadow. Interactive cards may lift slightly.
- **Border:** Light mode uses slate or near-white borders. Dark mode uses Dark Divider.
- **Internal Padding:** Dense cards use 16px to 20px. Larger panels and modals use 24px.

### Inputs / Fields

Inputs are quiet, rectangular and predictable.

- **Style:** 40px height, 12px radius, light surface, dark carbon surface, thin border and 12px horizontal padding.
- **Focus:** Border shifts to primary and adds a soft primary ring.
- **Error / Disabled:** Error must use red plus text or icon. Disabled uses opacity and cursor state, not just color.

### Navigation

Navigation is an app-shell pattern with a left sidebar, top utility bar and mobile bottom nav on operational routes. Active items use a soft primary background, primary icon color and a compact leading indicator. Collapsed sidebar items expose tooltips. Mobile routes keep core actions reachable without hiding them behind the desktop sidebar model.

### Signature Component: Financial Summary Card

Financial KPI cards combine label, icon, value, trend chip and helper text. Use semantic tone maps for positive, negative and neutral movement. Never invent values for these cards; show real data, a loading/skeleton state, an honest empty state or an actionable error.

## 6. Do's and Don'ts

### Do:

- **Do** preserve the product register: dense, predictable surfaces for owners, managers, receptionists and professionals.
- **Do** use Boutique Gold for current primary product actions and SMG blues for brand-aligned technology moments.
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
- **Don't** use saturated blue, gold, red or green as decoration on inactive states.
