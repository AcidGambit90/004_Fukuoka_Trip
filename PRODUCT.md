# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Google Apps Script (GAS) Web App: Backend in `code.gs` reading/writing Google Sheets, Frontend in single `index.html` using Tailwind CSS (CDN) and Google Apps Script Client API (`google.script.run`).

## Users
Independent travelers / companions on a trip to Fukuoka/Japan, using their mobile devices on the go (walking around stations like Hakata, Tenjin, Canal City, Daimyo) as well as during pre-trip planning.

## Product Purpose
A fast, responsive, and intuitive mobile-friendly travel companion and exploration guide synced directly with the user's Google Sheets data (`PI_Japan_list`). It eliminates the friction of navigating raw spreadsheets on smartphones, enabling travelers to instantly find places to eat, shop, drink coffee, check ratings, track trip expenses, and reference return flight schedules.

## Positioning
A purpose-built, live-synced Fukuoka travel companion that bridges Google Sheets data management with a polished, native-feeling mobile web app experience—requiring zero external hosting or server infrastructure beyond Google Apps Script.

## Operating Context
- Environments: On-the-go mobile browsers under cellular networks, walking through shopping districts, train stations, and eateries in Fukuoka.
- Primary Data Source: Google Spreadsheet (`PI_Japan_list` with columns: Flag, Rating, Type, Station, Shop, Location, Desc, Maps_Photo, Maps_Rating).
- Host / Deployment: Google Apps Script Web App (published as Web App via Apps Script editor).

## Capabilities and Constraints
- Live data fetching and syncing from Google Sheets via `code.gs` `doGet` / `google.script.run`.
- Fast search & multi-faceted filtering (by Station, Category/Type, Starred/Flagged status, Rating).
- Card / list views optimized for mobile readability and one-handed thumb interaction.
- Direct external links to Google Maps / navigation where available.
- Tab / module for trip expense recording (บันทึกค่าใช้จ่าย).
- AI Receipt Scanner & Tax Refund integration: Multi-shot capture for long Japanese shopping slips (Donki, Bic Camera, drugstores) using Gemini Flash, automatic item extraction into individual rows with Receipt ID linking, and instant navigation to grouped Tax Refund dashboard.
- Tab / section for return flight schedule and departure timing (เที่ยวบินขากลับ / เวลา).
- Architecture constrained to `code.gs` and `index.html` for clean and portable Google Apps Script deployment.

## Brand Commitments
- Tone: Friendly, clean, efficient, modern Japanese travel aesthetic (warm accents, high legibility, minimal cognitive clutter).
- Visual Design Constraint: Tailwind CSS via CDN, fully responsive layout adapting seamlessly from mobile viewports to desktop screens.

## Evidence on Hand
- Live Google Sheets spreadsheet: `PI_Japan_list` (Sheet ID: `1yfaW28yFr-fTCeJYxHTpIVdeTADmDnHAfcYZnVXCJ38`, ~120+ curated Fukuoka shops, food stalls, coffee shops, sushi bars, and shopping locations).
- Screenshots in `Web Screen short/` showing reference UI layouts and style inspiration.
- Requirements documented in `00_Prompt_temp.txt` and `01_Requirement.txt`.

## Product Principles
- **Speed & Glanceability**: Mobile travelers need to find spot names, stations, and ratings in under 3 seconds without pinch-zooming.
- **Zero Hosting Friction**: Self-contained within the Google Apps Script ecosystem so anyone can deploy, share, and update without server maintenance.
- **Data Fidelity**: Respects and reflects Google Sheet changes dynamically without manual sync steps.
- **Thumb-Friendly Navigation**: Primary filters, tabs, search, and action buttons comfortably accessible in single-hand mobile posture.

## Accessibility & Inclusion
- High contrast readable text against clean backgrounds under outdoor daylight conditions.
- Legible typography supporting Thai, English, and Japanese location names.
