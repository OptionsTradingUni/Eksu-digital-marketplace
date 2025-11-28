# EKSU Campus Marketplace

## Overview

The EKSU Campus Marketplace is a secure and efficient platform designed for students of Ekiti State University (EKSU) to buy and sell items. It aims to be the leading campus marketplace, fostering a safe trading environment and generating revenue through features like featured listings, transaction fees, and premium subscriptions. Key capabilities include real-time communication, a robust trust system, role-based access, and advanced safety features.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

The marketplace employs a modern full-stack architecture focusing on performance, security, and user experience.

**UI/UX Decisions:**
- **Design System:** Shadcn UI + Tailwind CSS for a responsive, mobile-first design.
- **Theming:** Full dark mode support with persistent user preferences.
- **Real-Time Features:** WhatsApp-inspired chat UI, real-time status updates.
- **Safety Features:** Safety Shield Modal, enhanced seller cards with trust scores, and an auto-follow system for new users to receive safety tips from the "Campus Hub" system account.
- **Navigation:** Enhanced bottom navigation and header with dedicated links for messages, VTU Data, and settings.
- **Social Features:** X/Twitter-style "The Plug" feed with "For You/Following" tabs, bookmarking, and post engagement tracking; user profiles with cover photos, avatars, pinned posts, and content tabs.
- **Interaction:** Haptic feedback on mobile, pull-to-refresh, and back-to-top functionality.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Wouter for routing, TanStack Query for data fetching, and WebSockets for real-time communication. Lazy loading, image lazy loading, and skeleton loaders optimize performance.
- **Backend:** Express.js, PostgreSQL with Drizzle ORM, Passport.js for authentication, and a WebSocket server.
- **Authentication:** Email/password with role selection (buyer/seller), session management, and protected routes. Admin/Support roles managed via environment variables and database flags.
- **Products:** Multi-image uploads, search/filter, seller dashboard, and admin moderation.
- **Chat:** WebSocket-based messaging, message threads, online/offline status, image lightbox, voice input, and message deletion.
- **User Management:** Editable profiles, verification badges, trust scores, sales history, user blocking/reporting, and a virtual wallet with escrow support.
- **Admin Panel:** User/product moderation, platform analytics, revenue tracking, and comprehensive support ticket management.
- **AI Chatbot:** Groq-powered with automatic payment scam detection, safety warnings, quick help buttons, Nigerian language support, and a smart handoff system to human support based on frustration detection and issue classification.
- **Payment System:** Squad/Habari integration for Card, Bank Transfer, USSD with instant settlements, fee calculation, seller payouts, and bank verification.
- **Order Management:** 11 delivery statuses with audit trails, role-based permissions, unique order numbers, and escrow integration.
- **Security:** Role-based access control, user verification, reporting, admin moderation, session management, and HTTPS.
- **Location Services:** Geolocation with IP fallback, campus detection, distance calculation, and location-aware feed algorithms.
- **KYC Verification:** Multi-step wizard with ID and liveness detection for user verification.
- **VTU Data Sales:** Integrated SMEDATA.NG API for data resale with phone number validation and wallet integration.
- **PWA Support:** Service worker for offline caching, install prompt, and offline indicator.
- **Support Ticket System:** Threaded conversations, atomic ticket numbering, status tracking, and admin management.
- **Social Post Reporting:** Users can report posts, which are auto-hidden after a threshold.

**System Design Choices:**
- **Database Schema:** Structured for Users, Products, Categories, Messages, Reviews, Watchlist, Reports, Support Tickets, KYC, and Sponsored Ads.
- **File Structure:** `client/` for frontend, `server/` for backend, `shared/` for common utilities.
- **API Endpoints:** Organized by functionality (Auth, Products, Messages, Users, Admin, Categories, Watchlist, Reviews, Chatbot, Error Reporting, Support, VTU).

## External Dependencies

- **PostgreSQL:** Primary database.
- **Groq API:** For AI Chatbot (`llama-3.3-70b-versatile`).
- **Squad/Habari API:** Payment gateway with retry logic (3 attempts, exponential backoff) and user-friendly error messages.
- **Passport.js:** Authentication middleware.
- **Drizzle ORM:** Database interaction.
- **Socket.io-like WebSocket:** Real-time communication.
- **Multer:** Image uploads.
- **SMEDATA.NG API:** For Virtual Top-Up (VTU) data sales (graceful fallback to database if API unavailable).
- **Resend Email API:** Primary email service with Brevo, Gmail, Mailgun fallbacks.
- **Render:** Recommended deployment platform.

## Recently Completed Features (V2)

### ✅ **Email Verification System**
- 6-digit code generation with email delivery
- One-click verification link support
- Token-based verification with expiry
- Professional email templates
- Email verification endpoint: `/api/auth/verify-email`
- Resend code endpoint: `/api/auth/resend-verification`

### ✅ **Password Strength Validation**
- Real-time strength indicator (Weak/Medium/Strong)
- Minimum "Medium" strength enforcement
- Requirements: 8+ chars, uppercase, lowercase, numbers, special chars
- Visual feedback in signup form
- Validation before account creation

### ✅ **System Account (@EksuMarketplaceOfficial)**
- Official account: `@EksuMarketplaceOfficial`
- Email: `system@eksucampusmarketplace.com`
- Auto-follows new users on signup
- Sends welcome DM with campus trading tips
- System account type flags for special handling

### ✅ **Email Notifications**
- **New Messages:** `sendMessageNotification()` triggers when user receives message
- **Order Updates:** Emails sent to buyer/seller on order status changes (confirmation, shipped, delivered, completed)
- Professional HTML email templates
- Async sending to prevent request blocking

### ✅ **Enhanced Error Handling**
- User-facing messages hide developer details
- Full error details logged to console
- 500 errors automatically emailed to admin (system@eksucampusmarketplace.com)
- Sanitized error responses prevent information leakage
- Error tracking and reporting system

### ✅ **Squad Payment API Improvements**
- Retry logic with exponential backoff (3 attempts)
- Error categorization: payment_error, network_error, validation_error
- User-friendly error messages
- Automatic transaction status updates
- Webhook handling for payment confirmations

### ✅ **VTU Integration (Graceful Fallback)**
- Primary: SMEDATA.NG API `/plans` endpoint
- Fallback: Static database plans if API returns 404
- Phone number validation
- Wallet integration for data purchase
- Error handling prevents app crash on API failure

### ✅ **Security Enhancements**
- Error sanitization prevents dev detail leakage
- Admin email notifications for system errors
- Session security with Passport.js
- Protected routes with authentication middleware
- Email notifications for sensitive operations
- **SMEDATA.NG API:** For Virtual Top-Up (VTU) data sales.
- **Render:** Recommended deployment platform.

## Recent Changes (November 2024)

### Theme System Enhancement
- Added 8 themes: light, dim, lights-out, sunset, ocean, forest, sepia, high-contrast
- Full CSS variable support for all themes with proper color schemes
- Theme selector with visual color previews and proper icon contrast

### User Profile Improvements
- Added gender field to user schema with dropdown selection in settings
- Values: Male, Female, Other, Prefer not to say

### The Plug Social Feed
- Redesigned post composer to full-screen Twitter/X-style interface
- Added scroll lock handling for mobile composer
- Follow button hides completely for already-followed users

### Confessions Page
- Added optimistic updates for voting (like/dislike)
- Instant UI feedback before server response

### Product View
- Fixed product image sizing on mobile with max-height constraints (max-h-[60vh])

## Recent Changes (November 28, 2024)

### Mobile UX Enhancements
- Fixed 100vh viewport bug with 100dvh, -webkit-fill-available fallbacks, and safe-area-inset padding
- Added keyboard-aware-input class to prevent keyboard from covering inputs in chats/comments
- Added pb-safe utility class for safe area bottom padding

### Toast Notification System
- Added 4 color variants: success (green), info (blue), warning (yellow), destructive (red)
- Consistent styling with proper close button colors per variant
- ToastViewport includes safe-area-inset-bottom padding

### Verification Badge System
- New VerificationBadge component at `client/src/components/VerificationBadge.tsx`
- Badge types: verified (blue check), official (purple crown), seller (gold badge), admin (red shield)
- Priority order: admin > official > seller > verified
- Integrated in ProductCard with full seller flag support

### Comment Bottom Sheet
- Converted comment modal from Dialog to Sheet component in confessions.tsx
- Slides up from bottom with mobile-friendly styling
- Includes pb-safe and keyboard-aware-input classes

### Profile Page Updates
- Gender selector now integrated into Edit Profile form using FormField
- Proper form validation and submission with other profile fields
- Values: Male, Female, Other, Prefer not to say

### Category Filter Enhancement
- Added search Input in FilterPanel for quick category finding
- Real-time filtering as user types
- Categories displayed in scrollable list with buttons

### Secret Messages Hub
- New public route at `/secret` with dark purple gradient theme
- Ghost icon branding with feature cards explaining anonymous messaging
- Call-to-action buttons for signing in and getting started
- Fully accessible without authentication

### Study Materials (Past Questions) Feature
- Complete schema with studyMaterials, studyMaterialPurchases, studyMaterialRatings tables
- Material types: past_question, handout, summary, textbook, lab_report, project, lecture_note
- Academic levels: 100L-500L, postgraduate
- Wallet-based purchases with 90% seller / 10% platform revenue split
- File upload to object storage with download tracking
- Rating and review system

### Hostel & Roommate Finder Feature
- Hostel listings with multi-image support (up to 10 images)
- Filter by location (EKSU areas), bedrooms (1-4+), price range
- Amenities tracking: WiFi, electricity, water, security, parking, etc.
- Agent contact integration with messaging
- Distance from campus field
- Database-level bedroom filtering with >= support for "4+" option

## Known Configuration Issues

### Email Service (Resend)
- **Status:** API key configured but domain verification required
- **Issue:** Resend requires DNS records (DKIM, SPF) to be added to your domain
- **Solution:** 
  1. Log into Resend dashboard (resend.com)
  2. Add your domain and get DNS records
  3. Add the records to your domain's DNS settings
  4. Verify domain in Resend dashboard
- **Fallback:** Gmail SMTP is available as backup (GMAIL_USER, GMAIL_APP_PASSWORD configured)

### Payment Gateway (Squad/Habari)
- **Status:** API keys configured but may need verification
- **Issue:** 403 errors may indicate credentials need revalidation
- **Solution:**
  1. Log into Squad dashboard (squadco.com)
  2. Verify API credentials (Public Key, Secret Key)
  3. Ensure account is in correct mode (test vs live)
  4. Check webhook URL configuration points to your app URL
- **Fallback:** Users can still use wallet balance for internal transactions

### Database Games Tables
- **Status:** Created via direct SQL (drizzle-kit push has interactive prompts)
- **Tables Created:** games, game_matches, trivia_questions, typing_texts, price_guess_products
- **Note:** Schema is synced with database, no migration issues
