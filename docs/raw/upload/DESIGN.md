---
name: Clinical Bone Densitometry Interface
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#0059b8'
  on-secondary: '#ffffff'
  secondary-container: '#0071e6'
  on-secondary-container: '#fefcff'
  tertiary: '#004b59'
  on-tertiary: '#ffffff'
  tertiary-container: '#006477'
  on-tertiary-container: '#76e2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#abc7ff'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#004590'
  tertiary-fixed: '#afecff'
  tertiary-fixed-dim: '#48d7f9'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5d'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-mobile: 16px
  container-padding-desktop: 32px
  gutter: 24px
  section-gap: 40px
---

## Brand & Style
The design system is engineered for clinical precision, reliability, and diagnostic clarity. It serves healthcare professionals—radiologists, technicians, and physicians—who require an interface that minimizes cognitive load while maximizing data accuracy for bone density (DXA) scans.

The aesthetic follows a **Minimalist Corporate** movement, prioritizing functional whitespace and a structured information hierarchy. The emotional response is one of "Informed Trust," evoking a sense of high-grade medical technology through a sterile but welcoming visual language. Every design decision is filtered through the lens of patient safety and professional efficiency.

## Colors
The palette is centered on **Clean Medical Blue (#0052CC)**, a hue synonymous with professional healthcare and institutional reliability. 

- **Primary:** Used for the most important actions, active states, and navigation headers.
- **Secondary & Tertiary:** Utilized for secondary data visualizations (e.g., distinguishing between T-scores and Z-scores) and interactive sub-elements.
- **Neutral:** A range of soft greys and whites to reduce eye strain during long diagnostic sessions.
- **Semantics:** Critical for medical UI; red is reserved for osteoporosis risk zones, amber for osteopenia, and green for healthy density ranges.

## Typography
This design system utilizes **Inter** for all typographic roles. Inter’s tall x-height and clear apertures ensure maximum legibility for clinical readings and numerical data.

- **Headlines:** Set with tight tracking and medium-to-bold weights to clearly anchor different sections of the medical report.
- **Body Text:** Optimized for Vietnamese diacritics, ensuring that complex accents do not collide or reduce readability.
- **Labels:** Use a slightly higher font weight and uppercase styling for "fixed" metadata like patient ID and scan dates.
- **Data Mono:** While Inter is sans-serif, its tabular numeric features should be enabled for T-score tables to keep decimal points aligned.

## Layout & Spacing
The layout employs a **12-column Fixed Grid** for desktop environments to maintain consistency across standardized medical monitors (1920x1080). 

- **Grid Logic:** A base 8px unit governs all spacing.
- **Structure:** A persistent left-hand navigation rail (240px) houses the patient directory and scan history. The main content area uses a three-pane logic: (1) Patient Info, (2) Scan Imagery/Visualization, and (3) Diagnostic Reporting.
- **Adaptability:** On tablets, the grid shifts to 8 columns with the navigation rail collapsing into a burger menu to prioritize the visual workspace.

## Elevation & Depth
Depth is used sparingly to maintain a "flat and clean" clinical feel. The design system uses **Tonal Layering** supplemented by **Ambient Shadows**.

- **Level 0 (Surface):** `#F4F5F7` (Neutral Background). Used for the application canvas.
- **Level 1 (Card):** `#FFFFFF` (White). Used for diagnostic modules and data tables. These have a very soft, 10% opacity shadow with an 8px blur to lift them from the background.
- **Level 2 (Overlay):** Used for modals or patient profile dropdowns. These feature a slightly deeper shadow and a subtle border (#DFE1E6) to ensure separation.
- **Interaction:** Only buttons and active input fields utilize "active" elevation states; other elements remain static to avoid visual distraction during analysis.

## Shapes
The shape language is **Rounded (Level 2)**. 

- **Standard Elements:** Buttons, inputs, and cards use a `0.5rem` (8px) radius. This balances the professional rigidity of a medical tool with a modern, user-friendly approach.
- **Containers:** Larger dashboard modules use `rounded-lg` (16px) to soften the overall appearance of the dense data interface.
- **Data Nodes:** Indicators on bone density charts use circular markers (pill-shaped) to represent data points clearly against grid lines.

## Components

### Buttons
- **Primary:** Solid #0052CC with white text. High-contrast for critical "Save Report" or "Start Scan" actions.
- **Secondary:** Outlined with a 1px #0052CC border and light blue hover states. Used for "Add Note" or "Print PDF."

### Diagnostic Cards
- White containers with a 1px #DFE1E6 border. These house bone density graphs (BMD) and must include a clear header and action area.

### Input Fields
- Clean, outlined inputs with a 2px blue focus ring. Labels are always persistent (never placeholder-only) to prevent errors in patient data entry.

### Bone Density Gauges
- Custom components featuring a color-coded spectrum (Green to Red). A white needle or indicator marks the patient's current T-score.

### List Items (Patient Records)
- Compact rows with clear status badges (e.g., "Hoàn thành," "Đang chờ," "Cần kiểm tra"). Hovering a row should apply a subtle #F4F5F7 background tint.

### Checkboxes & Radios
- Standardized with the Primary Blue. Larger hit-zones (min 44px) are required for touch-screen medical monitors.