# Wolf Mother Wellness Admin Dashboard Design Guidelines

## Design Approach

**System Selection**: Carbon Design System with Linear-inspired refinements
**Rationale**: Admin dashboard prioritizing data density, operational efficiency, and staff productivity. Carbon's enterprise patterns combined with Linear's modern aesthetic create a professional, high-performance workspace.

**Core Principles**:
- Information density without clutter
- Scannable data hierarchies
- Consistent interaction patterns
- Minimal cognitive load for repetitive tasks

---

## Typography System

**Font Family**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for data/IDs)

**Hierarchy**:
- Page Headers: text-2xl font-semibold (32px)
- Section Headers: text-lg font-semibold (20px)
- Table Headers: text-sm font-medium uppercase tracking-wide (14px)
- Body Text: text-sm font-normal (14px)
- Data Fields: text-sm font-mono (14px for IDs, codes, amounts)
- Labels: text-xs font-medium uppercase tracking-wider (12px)
- Helper Text: text-xs (12px)

---

## Layout System

**Spacing Primitives**: Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: space-y-6, gap-8
- Table cell padding: px-4 py-3
- Form field spacing: space-y-4
- Card padding: p-6

**Grid Structure**:
- Sidebar: w-64 fixed left navigation
- Main Content: ml-64 with max-w-7xl container
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Data Tables: Full-width within container
- Form Layouts: max-w-2xl for single-column forms, grid-cols-2 gap-6 for multi-column

---

## Component Library

### Navigation Sidebar
- Fixed left sidebar (w-64, h-screen)
- Logo placement at top (p-6)
- Navigation sections with headers (text-xs uppercase tracking-wider, px-4, mb-2)
- Nav items: rounded-lg px-4 py-2 hover states, active state with subtle accent
- User profile at bottom with avatar, name, role

### Data Tables
**Structure**:
- Container: border rounded-lg overflow-hidden
- Header row: bg-subtle with sticky top-0
- Cells: px-4 py-3 border-b
- Hover rows: subtle background change
- Zebra striping for rows exceeding 10 items

**Column Types**:
- Text columns: text-left
- Number/Amount columns: text-right font-mono
- Status columns: centered with badges
- Action columns: text-right with icon buttons

**Pagination**: Bottom placement with items-per-page selector, page numbers, and prev/next buttons

### Status Badges
**Variants**:
- Active: px-3 py-1 rounded-full text-xs font-medium
- Pending: Same structure with distinct treatment
- Expired: Same structure
- Cancelled: Same structure
- Paid: Same structure
- Overdue: Same structure

All badges inline-flex items-center gap-1 with optional dot indicator

### Forms
**Input Fields**:
- Container: space-y-1.5
- Labels: text-sm font-medium mb-1
- Inputs: px-4 py-2.5 rounded-lg border focus:ring-2
- Helper text: text-xs mt-1
- Error states: border-error with error message text-xs

**Field Types**:
- Text inputs, email, tel, number: consistent height (h-11)
- Select dropdowns: Same height with chevron icon
- Textareas: min-h-32 with resize-y
- Date pickers: Integrated calendar icon right
- Search fields: Search icon left, clear icon right

**Form Actions**: 
- Right-aligned button group
- Primary action (solid), Secondary (outlined), spacing gap-3

### Dialogs/Modals
**Structure**:
- Overlay: fixed inset-0 backdrop-blur-sm
- Modal: max-w-lg to max-w-2xl centered, rounded-xl
- Header: p-6 border-b with title (text-lg font-semibold) and close button
- Body: p-6 space-y-4
- Footer: p-6 border-t with action buttons right-aligned

### Action Buttons
**Primary Actions**: px-4 py-2.5 rounded-lg font-medium transition
**Icon Buttons**: p-2 rounded-lg (for table rows, toolbars)
**Button Groups**: flex gap-2 for related actions
**Dropdown Menus**: Relative positioning with absolute dropdown (min-w-48, rounded-lg, shadow-lg)

### Dashboard Cards
**Stat Cards**:
- Container: p-6 rounded-lg border
- Icon: w-12 h-12 rounded-lg with icon centered
- Label: text-sm font-medium
- Value: text-3xl font-semibold font-mono
- Change indicator: text-xs with arrow icon (up/down)

**Quick Action Cards**: Similar structure with action buttons at bottom

### Data Visualizations
- Chart containers: p-6 rounded-lg border
- Headers with title and time period selector
- Use Chart.js or Recharts for implementation
- Consistent height: h-80 for dashboard charts

---

## Page Templates

### Dashboard Overview
- 4-column stat cards grid (members, active memberships, today's check-ins, pending payments)
- 2-column layout below: Recent check-ins table (left 2/3), Upcoming expirations list (right 1/3)
- Revenue chart full-width at bottom

### Members List
- Search and filter toolbar (search input, membership filter dropdown, status filter, date range picker)
- Action buttons right-aligned (Add Member, Export, Settings icon)
- Full-width data table with columns: Avatar+Name, Email, Phone, Membership Type, Status Badge, Join Date, Actions
- Bulk selection checkboxes in first column

### Member Detail View
- Two-column layout: Profile info sidebar (left 1/3), Tabbed content area (right 2/3)
- Tabs: Overview, Membership History, Check-ins, Payments, Notes
- Quick action buttons in header (Edit, Send Message, Archive)

### Check-in Interface
- Prominent search field for member lookup
- Recent check-ins list below with timestamps
- Quick stats: Today's total, Current capacity
- Manual check-in button and QR scanner integration option

### Forms (Add/Edit)
- Breadcrumb navigation at top
- Form title and description
- Grouped sections with section headers
- Two-column layout for related fields
- Sticky footer with Cancel and Save buttons

---

## Icons
**Library**: Heroicons (via CDN)
**Usage**:
- Navigation: 20px icons
- Buttons: 16px inline with text
- Table actions: 20px
- Status indicators: 12px dots
- Form inputs: 20px

---

## Accessibility
- Consistent focus indicators (ring-2 offset-1)
- ARIA labels for icon-only buttons
- Keyboard navigation support for all interactive elements
- Screen reader text for status badges
- Proper heading hierarchy throughout