# Figma Token Mapping Guide

This document explains how Figma design tokens are mapped to semantic CSS variables used throughout the Ikarus Dashboard.

## Overview

The project uses a two-layer token system:
1. **Figma Tokens** (`figma-tokens.css`) - Raw tokens exported from Figma
2. **Semantic Variables** (`index.css`) - Human-readable variable names mapped to Figma tokens

## Color Mappings

### Text Colors (Ink)
| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--color-ink-900` | `--color-2` | `#011309` | Primary dark text, headings |
| `--color-ink-800` | `--color-vector` | `#1f242e` | Secondary dark text |
| `--color-ink-700` | `--color-1` | `#3e4f44` | Medium text, body content |
| `--color-ink-600` | `--color-title` | `#67716b` | Muted text, labels |
| `--color-ink-400` | `--color-property-1on` | `#99a19d` | Light text, disabled states |
| `--color-ink-muted` | - | `rgba(103, 113, 107, 0.72)` | Semi-transparent muted text |

### Surface Colors
| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--color-surface` | `--color-3` | `#ffffff` | White background, cards |
| `--color-surface-muted` | `--color-property-1default` | `#f2f3f3` | Light gray background |
| `--color-surface-subtle` | `--color-menu-item` | `#eef4e4` | Subtle green tint, hover states |
| `--color-surface-elevated` | `--color-frame-26910` | `#f5f8ef` | Elevated surfaces, modals |

### Primary Colors
| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--color-primary-700` | `--color-frame-1000003785` | `#124d5e` | Dark primary, focus states |
| `--color-primary-500` | `--color-button` | `#74a42d` | Main primary green, buttons |
| `--color-primary-300` | `--color-frame-1597886616` | `#d7e02d` | Light primary, accents |
| `--color-focus` | `--color-frame-1000003785` | `#124d5e` | Focus ring color |

### Status Colors
| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--color-success` | `--color-property-1available` | `#2ea561` | Success states, positive actions |
| `--color-info` | `--color-ellipse-668` | `#006c9c` | Info messages, neutral states |
| `--color-progress` | `--color-property-1charging` | `#006c9c` | Progress indicators |
| `--color-warning` | `--color-property-1preparingming` | `#de8e15` | Warning states, caution |
| `--color-danger` | `--color-property-1unavailable` | `#ed4a4a` | Error states, destructive actions |

## Typography Mappings

| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--font-display` | `--font-login-family` | `'Poppins'` | Headings, display text |
| `--font-body` | `--font-1-family` | `'Montserrat'` | Body text, paragraphs |
| `--font-mono` | - | `'Source Code Pro'` | Code, monospace text |

## Spacing Mappings

| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--spacing-xs` | `--spacing-5` | `4px` | Tight spacing |
| `--spacing-sm` | `--spacing-9` | `8px` | Small spacing |
| `--spacing-md` | `--spacing-13` | `12px` | Medium spacing |
| `--spacing-lg` | `--spacing-16` | `16px` | Large spacing |
| `--spacing-xl` | `--spacing-22` | `24px` | Extra large spacing |
| `--spacing-2xl` | `--spacing-26` | `32px` | 2x large spacing |
| `--spacing-3xl` | `--spacing-31` | `40px` | 3x large spacing |

## Border Radius Mappings

| Semantic Variable | Figma Token | Value | Usage |
|------------------|-------------|-------|-------|
| `--radius-xs` | `--spacing-9` | `8px` | Small radius, badges |
| `--radius-sm` | `--spacing-11` | `10px` | Small radius, buttons |
| `--radius-md` | `--spacing-13` | `12px` | Medium radius, inputs |
| `--radius-lg` | `--spacing-22` | `24px` | Large radius, cards |

## Shadow Mappings

| Semantic Variable | Figma Token | Usage |
|------------------|-------------|-------|
| `--shadow-sm` | `--shadow-property-1default` | Small shadows, subtle elevation |
| `--shadow-md` | `--shadow-card` | Medium shadows, cards |
| `--shadow-lg` | `--shadow-content` | Large shadows, modals |
| `--shadow-xl` | `--shadow-side-menu` | Extra large shadows, sidebars |
| `--shadow-focus` | `--shadow-property-1foucesd` | Focus ring shadows |

## Usage Examples

### In CSS Files
```css
.my-component {
  background: var(--color-surface);
  color: var(--color-ink-900);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

### In React Components
```jsx
<div style={{
  backgroundColor: 'var(--color-primary-500)',
  color: 'var(--color-surface)',
  padding: 'var(--spacing-lg)',
  borderRadius: 'var(--radius-sm)'
}}>
  Button
</div>
```

## Updating Tokens

When Figma tokens are updated:
1. Run the export script: `node scripts/export-figma.js`
2. The semantic mappings in `index.css` will automatically use the new values
3. No changes needed in component files - they use semantic variables

## Direct Figma Token Access

You can also use Figma tokens directly if needed:
```css
.custom-style {
  color: var(--color-button); /* Direct Figma token */
  font-family: var(--font-1-family); /* Direct Figma token */
}
```

However, it's recommended to use semantic variables for better maintainability.

