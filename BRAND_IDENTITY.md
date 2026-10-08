# Brand Identity & Design SystemTokens

## 1. Core Principles
- **Monochromatic Minimalism**: Focus on content (language learning). The interface gets out of the way.
- **Zero Emojis**: Strict use of vector icons (`lucide-react`) for all UI indicators.
- **Single-Viewport Preference**: Dashboard and Practice spaces should fit within `100vh` without vertical scroll on standard displays when possible.

## 2. Typography (Canonical 3-Font System)
- **Display & Headings**: `Syne`
  - Weights: Regular (400), Medium (500)
  - Letter-spacing: `-0.02em`
  - Usage: App Title, major section headers, welcoming messages.
- **Body & UI**: `Inter`
  - Weights: Light (300), Regular (400)
  - Usage: Live transcriptions, flashcard front/back, buttons, standard labels, tooltips.
- **Metrics & Numbers**: `IBM Plex Mono`
  - Weights: Regular (400), Medium (500)
  - Usage: Streak counters, B2 macro-goal ETA, SRS intervals, timer/duration displays.

## 3. Color Palette (Tailwind Integration)

### Backgrounds & Surfaces
- **Canvas (App Background)**: `#FFFFFF` (Pure White)
- **Cards & Surfaces**: `#F8F9FA` (Soft Off-White)
- **Borders/Dividers**: `rgba(0, 0, 0, 0.08)` or Tailwind `slate-200`.

### Actions & Text
- **Primary Brand / CTA**: `#18181B` (Zinc-900 / Dark Slate) for main buttons (e.g., Start Session, Microphone active).
- **Primary Text**: `#09090B` (Zinc-950)
- **Muted Text**: `#71717A` (Zinc-500)

### Semantic Colors (Badges, SRS Grades, Corrections)
- **Success / Easy (Correct)**: Emerald (`#10b981`)
- **Warning / Hard**: Amber/Gold (`#f59e0b`)
- **Error / Wrong**: Rose (`#e11d48`)
- **Tooltip Backgrounds**: `#0f172a` (Slate 900) with `#f8fafc` text.

## 4. Components (Shadcn UI overrides)
- **Buttons**: Square or slightly rounded (`rounded-md`), flat design, no heavy gradients.
- **Cards**: Flat, no heavy drop-shadows, just the ultra-thin border.
- **Badges**: Flat background with semantic colors (e.g., `bg-emerald-100 text-emerald-800`).
