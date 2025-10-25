# AI Contact Builder - Design Guidelines

## Design Approach

**Hybrid Strategy**: Combining modern SaaS aesthetics (Linear, Notion) with data-rich dashboard patterns (HubSpot CRM, Airtable) while maintaining a distinctive monochromatic identity and gamified elements.

**Core Philosophy**: Professional minimalism meets engaging gamification - create a sophisticated tool that feels rewarding to use.

---

## Visual Identity

### Monochromatic Foundation
- **Pure Black & White**: Use pure black (#000000) and pure white (#FFFFFF) as primary colors
- **Grayscale Spectrum**: Employ 6 shades of gray for depth and hierarchy:
  - Gray-50 (near white) for subtle backgrounds
  - Gray-100 for card backgrounds
  - Gray-200 for borders and dividers
  - Gray-600 for secondary text
  - Gray-800 for primary text
  - Gray-900 (near black) for emphasis

### Accent System
- **Single Accent**: Introduce one vibrant accent color (suggest electric blue #0066FF or neon green #00FF88) exclusively for:
  - Primary CTAs
  - Progress indicators
  - Success states
  - Interactive highlights
- **Usage Rule**: Accent appears sparingly (5-10% of interface) to create maximum impact

---

## Typography System

### Font Families
- **Primary**: Inter or DM Sans (clean, modern sans-serif via Google Fonts)
- **Display**: Space Grotesk or Archivo Black for hero headlines (bold, geometric)
- **Mono**: JetBrains Mono for API keys, code snippets, confidence scores

### Type Scale
- **Hero Display**: 72px (desktop) / 48px (mobile) - ultra-bold, tight letter-spacing (-2%)
- **H1**: 48px / 36px - bold
- **H2**: 36px / 28px - semibold
- **H3**: 24px / 20px - semibold
- **Body Large**: 18px - regular
- **Body**: 16px - regular
- **Small**: 14px - medium
- **Tiny**: 12px - medium (labels, metadata)

### Hierarchy Principles
- Use weight variations (400, 500, 600, 700, 900) over size changes
- Maintain consistent line-height: 1.5 for body, 1.2 for headings
- Generous letter-spacing for all-caps labels (+5%)

---

## Layout System

### Spacing Units
Use Tailwind spacing primitives: **4, 8, 12, 16, 24, 32, 48, 64**
- Micro spacing (between related elements): 4-8
- Component padding: 16-24
- Section padding: 32-48 (mobile), 48-64 (desktop)
- Page margins: 64+ (desktop)

### Grid Structure
- **Container**: max-w-7xl (1280px) for main content
- **Cards**: max-w-6xl (1152px) for dashboard
- **Forms**: max-w-2xl (672px) for optimal readability
- **Multi-column**: 2 columns on tablet, 3-4 on desktop where appropriate (contact cards, feature grids)

---

## Component Library

### Navigation
**Top Bar** (fixed, backdrop-blur):
- Height: 64px
- Logo left, navigation center, user profile/API status right
- Border-bottom: 1px gray-200
- Sticky with subtle shadow on scroll

**Sidebar** (dashboard pages):
- Width: 280px (desktop), collapsible to 64px icon-only
- Background: gray-50 with 1px gray-200 border
- Icons: Heroicons via CDN
- Active state: accent-colored background with rounded corners

### Cards & Containers
**Contact Cards**:
- Rounded corners: 12px
- Border: 2px gray-200, hover transforms to accent color
- Padding: 24px
- Subtle shadow on hover: 0 8px 24px rgba(0,0,0,0.08)
- Include confidence badge (top-right corner, pill-shaped)

**Dashboard Sections**:
- Background: white
- Separator lines: 1px gray-200
- Inner padding: 32px

### Forms & Inputs
**Text Inputs**:
- Height: 48px
- Border: 2px gray-200, focus border accent color
- Rounded: 8px
- Padding: 12px 16px
- Placeholder: gray-400

**Buttons**:
- **Primary**: Black background, white text, accent-colored on hover (invert effect)
- **Secondary**: White background, black border, hover state with gray-100 fill
- **Ghost**: Transparent, hover gray-100 background
- Height: 48px (large), 40px (medium), 32px (small)
- Padding: 12-24px horizontal
- Border-radius: 8px
- Font-weight: 600

### Data Visualization
**Progress Bars** (gamification core):
- Height: 8px
- Background: gray-200
- Fill: accent color with animated shimmer effect
- Corner radius: 4px
- Include percentage label above

**Confidence Scores**:
- Display as: percentage (87%) + visual bar + color-coded badge
- 90-100%: Green indicator (exception to B&W rule for clarity)
- 70-89%: Yellow indicator
- Below 70%: Red indicator

**Stats Cards**:
- Large number display (48px, bold)
- Small label below (14px, gray-600)
- Icon (32px) in corner
- Hover effect: slight scale (1.02) and shadow

---

## Page-Specific Layouts

### Landing Page
**Hero Section** (full viewport):
- Large headline (72px) with animated gradient text effect (black to gray shimmer)
- Subheadline (24px, gray-600)
- Two CTAs: "Get Started" (accent, large) + "Watch Demo" (ghost, medium)
- Background: Abstract geometric pattern in gray-100 (subtle)
- Hero image: Right-aligned mockup of dashboard interface (floating card with subtle shadow)

**Features Grid** (4 sections):
- 2x2 grid (desktop), stack on mobile
- Each feature: large icon (64px), heading, description, micro-animation on hover
- Alternating layout: icon-left, icon-right pattern

**Social Proof**:
- Centered testimonial carousel
- Company logos in grayscale filter
- Stats counter with animated numbers on scroll

**CTA Footer Section**:
- Full-width, black background
- White text, accent CTA button
- Background pattern: subtle dot grid

### Document Upload Page
**Drop Zone** (central focus):
- Large dashed border (4px, gray-300)
- 400px height minimum
- Centered upload icon (96px)
- "Drag & Drop or Click to Upload"
- Supported formats list below
- Animated border on drag-over (accent color pulse)

**Upload Progress**:
- Side panel showing:
  - File name + size
  - Linear progress bar
  - Processing stages (OCR → Extraction → Analysis)
  - Real-time status updates with check marks

### User Profile & Settings
**Two-Column Layout**:
- Left: Profile card (avatar, name, email, member since, stats)
- Right: Tabbed sections (Personal Info, API Keys, Preferences, Billing)

**API Key Management**:
- Each service as collapsible card
- Show/hide toggle for keys (masked: ••••••••key123)
- Connection status indicator (green dot: connected, red: error)
- "Test Connection" button per service
- Last verified timestamp

### Contact Dashboard
**Search Bar** (prominent):
- Full-width, sticky below header
- AI-powered semantic search with microphone icon
- Example prompts below: "Find Python developers..." as pills

**Filters Sidebar** (left):
- Collapsible filter categories
- Checkboxes with counts
- Clear all button

**Contact Grid** (main area):
- Masonry layout for varied card heights
- Infinite scroll with loading skeleton
- Empty state with illustration and CTA

**Contact Detail View** (modal):
- Large header with avatar, name, title
- Tabs: Overview, Timeline, Skills, Sources, Export
- Floating action button: "Sync to HubSpot"

---

## Gamification Elements

### Achievement System
- Progress rings for profile completion (inspired by Apple Watch)
- Badges for milestones: "First 10 Contacts", "API Master", etc.
- Toast notifications for achievements (slide-in, top-right)

### Interactive Feedback
- Micro-animations on all interactions (scale, fade, slide)
- Loading states with skeleton screens (shimmer effect)
- Success celebrations: confetti burst on major actions (contact sync complete)

### Engagement Metrics
- Dashboard widget showing weekly activity graph
- Streak counter for daily usage
- Leaderboard if multi-user (optional)

---

## Animations & Interactions

**Principle**: Subtle and purposeful, never distracting

- **Page Transitions**: Fade-in with slight upward motion (200ms)
- **Card Hovers**: Lift effect (translateY -4px) + shadow increase (300ms ease-out)
- **Button Press**: Scale 0.98 on click
- **Loading**: Skeleton shimmer (1.5s infinite loop)
- **Modal Entry**: Backdrop fade + content scale from 0.95 to 1 (250ms)
- **Success States**: Green checkmark with scale pulse

---

## Images & Media

### Landing Page Images
- **Hero Image**: Dashboard mockup showing contact grid (right-aligned, 600px width)
- **Feature Icons**: Custom illustrated icons in black outline style
- **Background Elements**: Abstract geometric shapes, dot patterns, gradient meshes (all in grayscale)

### Dashboard
- **Contact Avatars**: Circular (48px default, 64px in detail view)
- **Empty States**: Custom illustrations (minimalist line art)
- **Icons**: Heroicons exclusively (24px default, consistent stroke-width)

---

## Accessibility & Polish

- Maintain WCAG AAA contrast ratios (21:1 for black/white)
- Focus states: 3px accent-colored outline with 2px offset
- Keyboard navigation: clear focus indicators on all interactive elements
- Screen reader: Proper ARIA labels for all icons and interactive components
- Consistent form validation: Inline error messages in red (exception to B&W rule)

---

## Responsive Behavior

- **Mobile**: Single column, collapsible navigation drawer, touch-optimized tap targets (48px minimum)
- **Tablet**: 2-column grids, persistent sidebar
- **Desktop**: Full multi-column layouts, hover states enabled

**Breakpoints**: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)