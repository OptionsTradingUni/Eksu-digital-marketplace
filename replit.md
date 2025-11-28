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