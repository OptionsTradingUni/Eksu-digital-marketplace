# Design Guidelines: EKSU Campus Marketplace Platform

## Design Approach

**Reference-Based Hybrid**: Drawing inspiration from Facebook Marketplace (trust & local focus), OLX Nigeria (mobile-first commerce), and WhatsApp (familiar chat patterns). This creates a platform students immediately understand while feeling purpose-built for campus commerce.

## Core Design Principles

1. **Trust-First Design**: Verification badges, user ratings, and security indicators are visually prominent throughout
2. **Mobile Dominance**: Every interaction optimized for one-handed mobile use
3. **Scan-First Hierarchy**: Information density managed for quick browsing of multiple listings
4. **Cultural Familiarity**: Design patterns that feel natural to Nigerian students

## Typography

- **Primary Font**: Inter (Google Fonts) - clean, legible at small sizes
- **Display Font**: Inter Bold for headings and price tags
- **Hierarchy**:
  - H1: 2xl (32px) - Page titles
  - H2: xl (24px) - Section headers  
  - H3: lg (20px) - Card titles, product names
  - Body: base (16px) - Descriptions, chat messages
  - Small: sm (14px) - Metadata, timestamps
  - Price Tags: 2xl Bold - High visual weight

## Layout System

**Spacing Units**: Use Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
- Cards: p-4 for mobile, p-6 for desktop
- Section spacing: py-8 on mobile, py-12 on desktop
- Grid gaps: gap-4 for listings, gap-2 for form elements

**Grid Structures**:
- Product listings: 2 columns on mobile (grid-cols-2), 3-4 on tablet/desktop (md:grid-cols-3 lg:grid-cols-4)
- Chat interface: Single column full-width
- Dashboard cards: 1 column mobile, 2-3 on desktop

## Component Library

### Navigation
- **Bottom Tab Bar** (mobile primary): Home, Sell, Messages, Profile - fixed position with active state indicators
- **Top Header**: Logo, search bar, user avatar with notification badge
- **Seller/Buyer Mode Toggle**: Prominent switch in profile section

### Product Cards
- Square aspect ratio product image (essential)
- Price badge overlaid on image (semi-transparent background with blur)
- Title (truncate to 2 lines)
- Location pin icon + campus area
- Verified seller badge (when applicable)
- Quick action buttons on hover (desktop) or press (mobile)

### Listings View
- Masonry grid for featured/homepage
- Standard grid for category pages
- List view option showing more detail (title, price, description preview, seller rating)

### Product Detail Page
- Image carousel with dot indicators
- Sticky bottom bar: Price + Chat/Buy Now buttons
- Seller card: Avatar, name, verification badge, rating stars, response time
- Full description with "Read more" expansion
- Related items horizontal scroll
- Report listing link (subtle, bottom of page)

### Chat Interface
- WhatsApp-inspired design (familiar to users)
- Buyer messages: left-aligned, light treatment
- Seller messages: right-aligned, accent treatment
- Product context card at top (image, price, title)
- Input bar: Text field, image upload, quick replies
- Online/offline status indicators
- Typing indicators

### Forms & Inputs
- Floating labels for text inputs
- Clear validation states (success green, error red with message)
- File upload: Drag-drop zone + mobile camera button
- Category select: Visual icon grid (mobile-friendly)
- Price input: Naira symbol prefix, number keyboard on mobile
- Image upload: Multi-image preview with reorder capability

### Trust & Verification Elements
- Verification badges: Checkmark icon in circle (Student ID, NIN, Phone)
- Rating stars: Filled gold stars + count "(124 reviews)"
- Trust score: Numerical + progress bar visual
- Escrow indicator: Shield icon + "Payment Protected" badge
- Report button: Flag icon, red accent on hover

### Admin Panel
- Data-dense dashboard with metric cards
- Tables with search, sort, filter capabilities
- User management: Quick ban/verify actions
- Moderation queue: Flagged listings with preview + action buttons
- Charts: Simple bar/line graphs for analytics

### Dark Mode
- Toggle in user profile settings
- Persistent preference saved to database
- Smooth transition between modes
- Dark mode optimized for AMOLED screens (true blacks)

## Images

### Product Images
- Required: Minimum 1, maximum 10 per listing
- Aspect ratio: 1:1 (square) for grid consistency
- Compression: Optimize for mobile data (Nigerian internet conditions)
- Placeholder: Gray background with camera icon when no image

### Profile Images
- Circular avatars throughout
- Default: Initials on colored background when no photo uploaded
- Verification overlay icon on verified users

### Hero Section (Homepage)
- Not applicable - marketplace apps prioritize immediate product browsing
- Instead: Featured/promoted listings carousel at top (3-5 items, auto-scroll)

### Promotional Banners
- Full-width banners between listing rows (every 12-15 products)
- Aspect ratio: 16:9 or 21:9
- Used for: Campus events, partner promotions, platform features

## Responsive Breakpoints

- Mobile: Base (< 768px) - primary design target
- Tablet: md (768px+) - 2-3 column layouts
- Desktop: lg (1024px+) - 4 column grids, side navigation appears
- Wide: xl (1280px+) - Max container width, more whitespace

## Key Interaction Patterns

- Pull-to-refresh on listing feeds
- Infinite scroll for product grids
- Swipe gestures: Delete chat (left swipe), archive listing (right swipe)
- Haptic feedback on primary actions (mobile)
- Toast notifications for confirmations
- Modal overlays for quick actions (boost listing, report user)

## Accessibility

- Minimum touch target: 44x44px for all buttons
- High contrast ratios in both light/dark modes
- Clear focus indicators for keyboard navigation
- Screen reader labels on all icons
- Form error announcements

## Performance Considerations

- Lazy load images below fold
- Paginated listings (load 20-30 at a time)
- Optimistic UI updates for chat messages
- Skeleton screens during data loading
- Cached images for offline viewing