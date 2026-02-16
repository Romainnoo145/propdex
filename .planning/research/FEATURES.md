# Feature Landscape

**Domain:** PropTech UX Redesign for Map-Centric Property Intelligence Platform
**Researched:** 2026-02-16

## Table Stakes

Features users expect in professional PropTech dashboards. Missing = product feels incomplete or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Icon-based sidebar navigation** | Standard in 2026 professional dashboards; sidebar menus common in admin dashboards, project management tools, SaaS platforms | Low | Already have side-rail with icons. Need refinement for 3-page structure |
| **Loading states (spinners + skeletons)** | Users must know system is working; industry standard since ~2020 | Low | Determinate for scans (known duration), indeterminate for quick operations |
| **Empty states with guidance** | "Zero states" tell users what will appear when data exists; reduces confusion | Low | Need for: no results, first-time scans, no projects yet |
| **Error states with recovery** | Clear explanations + recovery options build trust; required for professional tools | Medium | Need scan errors, API failures, network issues with retry mechanisms |
| **Success confirmations** | Toast notifications for completed actions; industry standard for async operations | Low | "Scan complete", "Project saved", "Data exported" |
| **Data table with sorting/filtering** | Core feature for property data; users expect search-engine-like speed | Medium | Already have TanStack Table; need advanced filters |
| **List-map sync (data brushing)** | Hovering row highlights marker; hovering marker highlights row; standard in map apps | Medium | Common in property search (LightBox, store locators); prevents disorientation |
| **Multi-select + bulk actions** | Industry standard for data tables; efficiency feature for power users | Medium | "Export selected", "Add to project"; toolbar appears when items selected |
| **Responsive mobile view** | Essential for field work; mobile design expected in 2026 | High | View-only mode acceptable for PropTech (desktop = primary workflow) |
| **Settings page** | Users expect control over account, notifications, privacy, regional preferences | Low | Standard categories: account, notifications, appearance, data management |
| **Progress indicators for scans** | Multi-step processes need steppers/progress bars; users want to know what's ahead | Medium | "Selecting gemeente → Fetching data → Processing → Complete" |
| **Contextual help/tooltips** | Professional tools provide in-app guidance; reduces support costs | Low | For zoning codes, opportunity scores, technical terms |
| **Export functionality** | Data export expected in B2B tools; CSV/PDF standard | Low | Already may exist; ensure UX is clear |

## Differentiators

Features that set product apart. Not expected, but valued. These create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Inspector slide-over panel** | Modern detail disclosure pattern; keeps context visible while showing parcel details | Medium | Better than modal (maintains map context); overlay or inline drawer variant |
| **Industrial Amber design system** | Distinctive visual identity; mustard/amber accents signal premium craftsmanship | Low | "Aires/Hudson 8" style; desaturated base + warm accent differentiates from generic PropTech |
| **Glassmorphism with industrial aesthetic** | Polished frosted-glass surfaces suggest advanced tech; common in fintech/premium tools | Medium | Matured beyond trend (Apple/Microsoft adoption); avoid overuse in data tables |
| **Silver/desaturated map style** | Professional, neutral base lets data overlays stand out; reduces visual noise | Medium | Custom MapLibre style; allows zoning colors to pop against muted background |
| **Streamlined scan flow** | Fewer clicks than competitors; context preserved throughout process | Medium | Competitors often multi-page; single-page with progressive disclosure wins |
| **Real-time scan progress visibility** | Transparency builds trust; users see system working vs black box waiting | Medium | Show what's happening: "Fetching kadaster...", "Analyzing 247 parcels..." |
| **Spatial filter interaction** | Click-to-define search area on map; more intuitive than address/boundary lists | High | Advanced but powerful; common in GIS tools, rare in PropTech |
| **Opportunity score visualization** | Quick visual scanning of best parcels; reduces cognitive load | Low | Color-coded indicators in table + map; inspired by LightBox's data-first approach |
| **Project organization** | Save scans, comparisons, notes; supports developer workflow beyond one-off searches | Medium | May already exist; ensure UX is polished vs afterthought |
| **Persistent filter state** | Filters survive navigation; users don't re-apply after viewing details | Low | Small UX win that compounds; reduces frustration |

## Anti-Features

Features to explicitly NOT build. These harm UX or dilute focus.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full mobile editing** | Complex map interactions don't work on small screens; developers work at desks | Build view-only mobile with "Open on desktop" for actions |
| **Auto-refreshing data tables** | Disorienting when rows shift during reading/selection; users lose place | Manual refresh button; show "New data available" banner |
| **Nested modal patterns** | Modal-within-modal creates navigation confusion; escape key ambiguity | Use slide-over panels that maintain parent context |
| **Overly complex filters** | AI-driven or NLP filters sound cool but add latency and unpredictability | Clean, logical filter categories with instant feedback |
| **Jargon in settings** | Technical labels (e.g., "Enable WMS layers") alienate users | Plain language: "Show detailed map layers" |
| **Excessive glassmorphism** | Frosted glass on data tables reduces readability; style over function | Use glass effects for navigation/chrome, solid backgrounds for data |
| **Auto-play animations** | Distracting in data-heavy tools; accessibility issue | Use animations for transitions only; respect prefers-reduced-motion |
| **Infinite scroll in tables** | Users can't bookmark position; pagination provides control | Pagination with configurable page size (25/50/100) |
| **Global search without scope** | Searching across projects/scans/parcels creates ambiguous results | Scoped search: "Search in current results" vs "Search all projects" |
| **Toast notifications for errors** | Critical errors need acknowledgment; toasts auto-dismiss | Toasts for success, banners/modals for errors requiring action |

## Feature Dependencies

```
Icon Sidebar Navigation
  └─> Settings Page (accessed via sidebar)
  └─> Main Pages (Map, Reports, Projects)

Scan Flow
  ├─> Progress Indicators (multi-step stepper)
  ├─> Loading States (spinner during fetch)
  └─> Success Confirmation (toast on completion)
      └─> Data Table (displays results)
          ├─> List-Map Sync (selection highlighting)
          ├─> Multi-Select + Bulk Actions (export, add to project)
          ├─> Sorting/Filtering (advanced filters)
          └─> Row Click → Inspector Slide-Over (detail view)
              └─> Map Context (remains visible behind panel)

Error States
  ├─> Scan errors (network, API failures)
  ├─> Empty states (no results)
  └─> Recovery actions (retry, modify search)

Mobile View
  └─> Read-only mode (no editing/scanning)
  └─> Responsive layout (tables → cards, map → full-screen)

Design System
  ├─> Industrial Amber palette (mustard accent, grey/white base)
  ├─> Glassmorphism (navigation chrome, not data areas)
  └─> Silver Map Style (desaturated PDOK base)
```

## MVP Recommendation

Prioritize for UX redesign milestone:

### Phase 1: Foundation (Design System)
1. **Industrial Amber design system** - Visual identity foundation
2. **Icon sidebar navigation** - Structure for 3-page layout
3. **Silver/desaturated map style** - Professional base for data overlays

### Phase 2: Core Interactions
4. **Inspector slide-over panel** - Modern detail disclosure (replaces drawer?)
5. **Loading states** - Spinners + skeleton screens
6. **Error states + recovery** - Professional error handling
7. **Success confirmations** - Toast notifications

### Phase 3: Data Table Polish
8. **List-map sync** - Hover highlighting
9. **Multi-select + bulk actions** - Power user efficiency
10. **Advanced filters** - Quick data refinement
11. **Empty states** - First-use guidance

### Phase 4: Scan Flow
12. **Progress indicators** - Multi-step stepper for scans
13. **Real-time scan progress** - "Fetching...", "Analyzing..." messages
14. **Streamlined flow** - Fewer clicks, better context

### Phase 5: Settings + Mobile
15. **Settings page** - Account, preferences, appearance
16. **Mobile view-only mode** - Responsive layout for field viewing

**Defer:**
- **Spatial filter interaction** - High complexity; nice-to-have for v4.1
- **AI-driven filtering** - Adds unpredictability; not needed for professional tool
- **Project organization enhancements** - If exists, polish later; if not, defer to v4.1
- **Contextual help system** - Add after core UX is solid

## Feature Complexity Notes

| Complexity | Features | Dependencies |
|------------|----------|--------------|
| **Low** | Icon sidebar, loading states, empty states, success toasts, settings page, opportunity score viz, persistent filters | Existing React components, design system |
| **Medium** | Error states, data table filters, list-map sync, multi-select, inspector slide-over, progress indicators, scan flow, glassmorphism, map styling, project organization | TanStack Table, MapLibre API, React state management |
| **High** | Mobile responsive, spatial filter | Significant responsive refactor OR advanced GIS interactions |

## Interaction Pattern Details

### Icon Sidebar Navigation
- **Pattern:** Sana AI's right-aligned icons (unconventional but modern) OR traditional left-aligned
- **Behavior:** Always visible; active page highlighted; icons + labels on hover/expand
- **Implementation:** 3 main pages (Map, Reports, Projects) + Settings at bottom
- **Dependency:** Already have side-rail; restructure for new page hierarchy

### Inspector Slide-Over Panel
- **Pattern:** Overlay drawer (right-to-left slide)
- **Visual:** Partial parent page visible (20-30%); transparent shade disables background
- **Content:** Parcel details (address, area, zoning, opportunity score, kadaster data)
- **Behavior:** Click table row OR map marker → slide-over opens; close via X, ESC, or click shade
- **Advantage:** Maintains map context vs full-screen drawer; modern alternative to modal

### List-Map Sync (Data Brushing)
- **Pattern:** Bi-directional highlighting
- **Behavior:** Hover table row → highlight map marker (border, scale, color); hover marker → highlight row (background color)
- **Implementation:** Shared state between TanStack Table and MapLibre layers
- **UX Win:** Prevents "where is this on the map?" disorientation

### Multi-Select + Bulk Actions
- **Pattern:** Floating contextual toolbar (appears above selected rows OR fixed at bottom)
- **Selection Levels:**
  - Row-level: Checkbox per row
  - Page-level: Header checkbox (all visible rows)
  - Global: "Select all X results" (if paginated)
- **Actions:** Export CSV, Add to Project, Compare
- **Display:** Show count "3 parcels selected"

### Progress Indicators
- **Scan workflow:** Horizontal stepper (4 steps: Select → Fetch → Analyze → Complete)
- **Visual:** Numbered steps with labels; current step highlighted; completed steps checked
- **Determinate:** Show percentage for known-duration operations
- **Indeterminate:** Spinner for quick unknown-duration operations

### Advanced Filters
- **Pattern:** Dedicated filter panel OR collapsible sections in sidebar
- **Organization:** Category groups (Location, Area, Zoning, Opportunity Score)
- **Feedback:** Real-time result count update as filters applied
- **Clear UX:** "Clear all filters" button; active filter chips
- **Avoid:** Modal overlays that block table; keep filters accessible

### Error States
- **Scan errors:** Banner above results area with retry button
- **Network errors:** Full-page error with "Try again" action
- **Partial failures:** Warning banner "Some data unavailable" with details
- **Empty results:** Illustrated empty state with suggestions ("Try broader filters")

### Mobile View-Only
- **Rationale:** Complex map interactions + data tables don't work on phones; developers use desktops
- **Approach:** Responsive layout for viewing saved projects/scans; "Open on desktop to edit" for actions
- **Table → Cards:** Transform data table to card list on mobile
- **Map:** Full-screen with simplified controls; detail panel slides up from bottom (not side)

### Settings Page
- **Categories:**
  - **Account:** Name, email, password, organization
  - **Notifications:** Email preferences (scan complete, project updates)
  - **Appearance:** Theme (light/dark), map style preferences
  - **Data:** Export history, data retention, privacy settings
- **Layout:** Tabbed navigation OR list with progressive disclosure
- **Pattern:** Shopify-style categorization for long settings lists

## Design System Integration

### Industrial Amber Palette
- **Base:** Grey/white desaturated (silver-ish neutrals)
- **Accent:** Mustard/amber (#D4A520 range) for CTAs, hover states, active selections
- **Semantic:**
  - Success: Muted green (not neon)
  - Warning: Warm amber (aligns with brand)
  - Error: Desaturated red
  - Info: Cool grey-blue
- **Inspiration:** Mid-century modern, industrial design, Aires/Hudson 8 architecture
- **Differentiation:** Warmer than typical PropTech (which skews blue/teal)

### Glassmorphism Application
- **Use:** Navigation chrome, sidebar, inspector slide-over header, modal overlays
- **Avoid:** Data tables, charts, map (readability paramount)
- **CSS:** `backdrop-filter: blur(10px)`, semi-transparent backgrounds, subtle borders
- **Performance:** Modern browsers + GPUs handle this well in 2026; no concerns

### Map Styling
- **PDOK base:** Desaturate to silver/grey tones (reduce color saturation by 60-70%)
- **Purpose:** Neutral canvas for data overlays (zoning colors, markers, boundaries)
- **Inspiration:** Professional GIS tools use muted bases to highlight data
- **Customization:** MapLibre style JSON; adjust HSV for continuous color schemes

## Real-World Pattern Sources

### LightBox Vision
- Component-oriented design with atomic methodology
- Light/dark theme support
- Strong visual hierarchy in data presentation
- 40% cost reduction for explorative ideas via design system
- **Takeaway:** Invest in design system foundation; pays off in velocity

### Transect
- Environmental risk + geospatial intelligence platform
- Combines traditional GIS with domain-specific data (permits, tax incentives)
- **Takeaway:** PropTech users want domain data, not just maps; integrate kadaster/zoning seamlessly

### Industry Dashboard Trends (2026)
- Less is more: Show only critical data, hide complexity
- Contextual prompts: Guide users to next action
- Role-based customization: Not needed for Propdex (single user type: developers)
- **Takeaway:** Prioritize clarity over comprehensiveness

### Map UI Patterns
- Location list + map sync: Standard in property search
- Extent-driven content: Changing map updates list
- Store locator patterns: Applicable to gemeente/wijk selection
- **Takeaway:** Leverage established patterns; users recognize them

## Confidence Assessment

| Feature Category | Confidence | Sources |
|------------------|------------|---------|
| Icon sidebar navigation | **HIGH** | Dashboard design trends 2026, sidebar menu examples, Sana AI case |
| Loading/error/empty states | **HIGH** | LogRocket, Carbon Design System, PatternFly, NN/g |
| Data table interactions | **HIGH** | Pencil & Paper UX analysis, Helios, PatternFly, enterprise patterns |
| Slide-over panel pattern | **HIGH** | Adobe Commerce, PatternFly drawer, Creative Bloq |
| Progress indicators | **HIGH** | Cieden, UserGuiding, PatternFly progress stepper |
| Toast notifications | **HIGH** | LogRocket, Chameleon, HPE Design System, NN/g |
| Mobile responsive | **HIGH** | Toptal, Dundas BI, Looker Studio, ArcGIS dashboards |
| Settings page | **MEDIUM** | UI patterns, Material Design, SetProduct, Shopify examples (no 2026 PropTech-specific sources) |
| Glassmorphism in dashboards | **MEDIUM** | 2026 trend articles + platform adoption, but subjective aesthetic choice |
| Map styling (desaturated) | **MEDIUM** | GIS best practices (ArcGIS, ColorBrewer), but no PropTech-specific 2026 standards |
| List-map sync | **HIGH** | Axis Maps, Map UI Patterns, MapTiler SDK examples |
| Industrial Amber design | **LOW** | General color trends 2026, but "Industrial Amber" is custom interpretation |
| Spatial filter | **MEDIUM** | GIS tools use this, but complexity high for PropTech MVP |

## Sources

### Dashboard Design & Navigation
- [9 Dashboard Design Principles (2026) | DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Dashboard Design UX Patterns Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [8+ Best Sidebar Menu Design Examples of 2025 (With UI Inspiration) | Navbar Gallery](https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples)
- [Curated Dashboard Design Examples for UI Inspiration (2026) | Muzli Blog](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)

### PropTech & Real Estate Platforms
- [LightBox – Senjal Pandharpatte](https://senjalpandharpatte.com/project/lightbox)
- [LightBox Vision℠ | LightBox](https://www.lightboxre.com/data/lightbox-vision/)
- [Environmental Risk & Renewable Site Assessment Platform | Transect](https://www.transect.com/)
- [Real Estate UX/UI Design Services for PropTech & SaaS | Eleken](https://www.eleken.co/industries/real-estate-ux-design-services)

### Loading, Error, and Empty States
- [UI best practices for loading, error, and empty states in React - LogRocket Blog](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/)
- [Empty states | Carbon Design System](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Error & Empty States: The Unsung Heroes of UX Design | Medium](https://medium.com/design-bootcamp/error-empty-states-the-unsung-heroes-of-ux-design-dcb99d99cc2b)
- [PatternFly • Empty state](https://www.patternfly.org/components/empty-state/design-guidelines/)

### Toast Notifications & Feedback
- [What is a toast notification? Best practices for UX - LogRocket Blog](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Toast Notifications | Chameleon](https://www.chameleon.io/patterns/toast-notifications)
- [Success Message UX Examples & Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/success-ux)
- [Toast notifications — HPE Design System](https://design-system.hpe.design/templates/toast-notifications)

### Data Table Patterns
- [Data Table Design UX Patterns & Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Filter UX Design Patterns & Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [Table multi-select | Helios Design System](https://helios.hashicorp.design/patterns/table-multi-select)
- [PatternFly • Bulk selection](https://www.patternfly.org/patterns/bulk-selection/)
- [Bulk action UX: 8 design guidelines with examples for SaaS](https://www.eleken.co/blog-posts/bulk-actions-ux)

### Slide-Over Panels & Drawers
- [Slide-out Panels, Modal Windows, and Overlays | Adobe Commerce](https://developer.adobe.com/commerce/admin-developer/pattern-library/containers/slideouts-modals-overlays)
- [PatternFly • Drawer](https://www.patternfly.org/components/drawer/design-guidelines/)
- [UI design pattern tips: slideouts, sidebars and drawers | Creative Bloq](https://www.creativebloq.com/ux/ui-design-pattern-tips-slideouts-sidebars-101413343)
- [PatternFly • Primary-detail](https://www.patternfly.org/patterns/primary-detail/design-guidelines/)

### Progress Indicators
- [Progress Trackers and Indicators – With 6 Examples To Do It Right](https://userguiding.com/blog/progress-trackers-and-indicators)
- [How to create progress indicator UI for better usability? | Cieden](https://cieden.com/book/atoms/progress-indicator/progress-indicator-ui)
- [PatternFly • Progress stepper](https://www.patternfly.org/components/progress-stepper/design-guidelines/)
- [32 Stepper UI Examples and What Makes Them Work](https://www.eleken.co/blog-posts/stepper-ui-examples)

### Mobile & Responsive Design
- [Intuitive Mobile Dashboard UI: 4 Best Practices | Toptal®](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [Responsive layout dashboard mode | Dundas BI](https://www.dundas.com/support/learning/documentation/create-view-content/responsive-layout-dashboard-mode)
- [How to Use Looker Studio's Responsive Layout for Mobile Dashboards](https://gaillereports.com/how-to-use-looker-studios-responsive-layout-for-mobile-dashboards/)
- [Dashboard mobile views—ArcGIS Dashboards | Documentation](https://doc.arcgis.com/en/dashboards/latest/reference/dashboards-on-your-smartphone.htm)

### Settings Page Design
- [Settings design pattern | UI Patterns](https://ui-patterns.com/patterns/settings)
- [App Settings UI Design: Usability Tips & Best Practices | SetProduct](https://www.setproduct.com/blog/settings-ui-design)
- [Settings - Patterns - Material Design](https://m1.material.io/patterns/settings.html)
- [8 Settings Page UI Examples: Design Patterns That Work](https://bricxlabs.com/blogs/settings-page-ui-examples)

### Glassmorphism
- [What is Glassmorphism? UI Design Trend 2026](https://www.designstudiouiux.com/blog/what-is-glassmorphism-ui-trend/)
- [Glassmorphism: What It Is and How to Use It in 2026 - The Inverness Design Studio](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [UI Design Trend 2026 #2: Glassmorphism and Liquid Design Make a Comeback | Medium](https://medium.com/design-bootcamp/ui-design-trend-2026-2-glassmorphism-and-liquid-design-make-a-comeback-50edb60ca81e)

### Map Interaction Patterns
- [Map interaction | Axis Maps](https://www.axismaps.com/guide/map-interaction)
- [Location list – Map UI Patterns](https://mapuipatterns.com/location-list/)
- [List and details – Map UI Patterns](https://mapuipatterns.com/list-details/)
- [How to sync the map with a list of places | MapTiler SDK JS](https://docs.maptiler.com/sdk-js/examples/list-of-places/)
- [10 Inspiring Interactive Map Design & UX Examples](https://traveltime.com/blog/interactive-map-design-ux-mobile-desktop)

### Color & Design Systems
- [Mustard Yellow Color: Hex Code, Palettes & Meaning | Figma](https://www.figma.com/colors/mustard-yellow/)
- [Top 20 Modern Color Combinations Must Use in 2026 - Pro Design School](https://prodesignschool.com/design/top-20-modern-color-combinations-must-use-in-2026/)
- [Better colors for better mapping | Esri ArcGIS Blog](https://www.esri.com/arcgis-blog/products/js-api-arcgis/mapping/better-colors-for-better-mapping)
- [Color schemes—ArcGIS Pro | Documentation](https://pro.arcgis.com/en/pro-app/latest/help/mapping/layer-properties/color-schemes.htm)
