# Design System

<!-- impeccable:design-schema 1 -->

## Design Direction & Aesthetic
A refined, modern Japanese travel editorial aesthetic: minimal, warm, and highly functional. Built specifically for on-the-go travelers navigating Fukuoka's vibrant urban transit districts (Hakata, Tenjin, Canal City, Daimyo) under varying ambient light conditions.

## Surface Mode
- **Operate & Explore**: Swift scanability, instant search, thumb-friendly touch targets (min 44px), high legibility for multilingual place names (Thai, English, Japanese).

## Color Tokens
- **Backgrounds**:
  - Primary Surface: `#FBF9F5` (Warm Cream / Stone 50)
  - Card Surface: `#FFFFFF` (Pure White)
  - Secondary/Muted Surface: `#F3EFEA` (Warm Sand / Stone 100)
- **Borders & Dividers**:
  - Subtle Border: `#E7E2DA` (Stone 200)
  - Focused/Active Border: `#D1C7B8` (Stone 300)
- **Text & Foreground**:
  - Primary Text: `#1C1917` (Stone 900 - high contrast, minimum 7:1)
  - Secondary Text: `#57534E` (Stone 600 - minimum 4.5:1)
  - Muted Text: `#78716C` (Stone 500)
- **Brand Accents**:
  - Primary Accent (Cinnabar / Japanese Red): `#D9381E` / `#C8321B` (used sparingly for active states, ratings, top pick badges)
  - Secondary Accent (Indigo / Tenjin Navy): `#1E293B` (for primary actions and dark mode/header highlights)
  - Badge Colors: Natural muted category tones (Warm Amber for Cafe, Olive/Forest for Food, Indigo for Shopping, Crimson for Top Picks)

## Typography
- Font Family:
  - Sans-Serif: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Sukhumvit Set', 'Kanit', sans-serif`
  - Font sizes: Strict scale (12px, 14px, 16px, 18px, 20px, 24px)
  - Line heights: 1.5 for body text, 1.25 for headings
  - Tracking: `-0.01em` to `-0.02em` for crisp headlines

## Elevation & Depth
- Single elevation model: Crisp 1px border (`border-stone-200`) paired with subtle ambient diffusion (`shadow-sm` / `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`).
- No harsh neobrutalist drop shadows or double-bordered cards.
- Border radii: `rounded-2xl` (16px) for cards and modals, `rounded-xl` (12px) for input fields, `rounded-full` for chips and pills.

## Component Patterns
- **Search & Filter Bar**:
  - Sticky at top with backdrop blur for smooth scrolling.
  - Search input with clear icon and real-time debounce.
  - Horizontal scrollable filter pills with comfortable touch boundaries.
- **Spot Card**:
  - Header: Flag icon (`★ Must-Visit` / `★ Pick`), Rating pill (`8.0 ★`), Category badge.
  - Body: Shop name (prominent 18px font-semibold), Station pill, Location/branch detail, Thai description/menu highlights.
  - Footer: Direct "Open in Maps" action button with external link icon.
- **Tab Navigation**:
  - Fixed mobile bottom navigation bar (or top pill segmented control on desktop):
    1. Spots (สำรวจสถานที่)
    2. Expenses (บันทึกค่าใช้จ่าย)
    3. Return Flight (เที่ยวบินขากลับ)
- **State Handling**:
  - Loading skeleton with subtle shimmer.
  - Zero results empty state with immediate "Clear Filters" action.
  - Error banner with retry mechanism.
