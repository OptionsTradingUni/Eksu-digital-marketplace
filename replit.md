# EKSU Campus Marketplace

## Overview

The EKSU Campus Marketplace is a secure and efficient platform for Ekiti State University (EKSU) students to buy and sell items. It aims to be the leading campus marketplace, fostering a safe trading environment and generating revenue through featured listings, transaction fees, and premium subscriptions. Key capabilities include real-time communication, a robust trust system, role-based access, advanced safety features, and a variety of social and utility features. The platform is designed to be a comprehensive campus hub for commerce, social interaction, and essential services.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## Recent Changes (November 2025)

- **VTU Rewards System**: Added comprehensive rewards/cashback points system with:
  - 10 points earned per N1,000 spent on data and airtime purchases
  - 4-tier system (Bronze, Silver 1.25x, Gold 1.5x, Platinum 2x multipliers)
  - Redemption options for wallet credit (100-5000 points for N100-N5000)
  - Rewards center UI at /rewards with tier display, point history, and redemption
  - Link to rewards from VTU page header
- **VTU Bulk Purchases**: Added bulk VTU purchase feature with CSV upload support for multiple recipients at once.
- **VTU Transaction Export**: Added PDF and Excel export functionality for VTU transaction history with date filtering.
- **VTU Reseller System**: Complete 3-tier reseller program with custom pricing, subdomain sites, and transaction tracking.
- **Explore Page**: New /explore page with all features organized by category (Marketplace, Housing, Education, Social, Services, Games, Support) for better feature discoverability.
- **Quick Services Section**: Home page now has a Quick Services grid with cards for Hostel Finder, Study Materials, VTU Data, Games, Secret Messages, and Explore All.
- **Improved Navigation**: 
  - Header Services submenu now includes Hostel Finder and Study Materials links
  - BottomNav has a new "More" menu with sheet-based access to all services (replaces single Games button)
- **Support Ticket Email Notifications**: Admin now receives email alerts when new tickets are created. Both admin and users receive email notifications when replies are posted to tickets.
- **Squad Payments Database Fix**: Created the missing squad_payments table to resolve "relation does not exist" production error.
- **Theme System**: Moved theme toggle to header (ThemeToggle component), removed from profile dropdown. Supports 8 themes: Light, Dim, Lights Out, Sunset, Ocean, Forest, Sepia, High Contrast.
- **Email Verification**: Added 6-digit OTP code input option alongside token-based verification. Includes resend functionality with cooldown.
- **Official Account Branding**: "Eksu Market Plug" official account uses favicon as profile pic, hides followers/following from non-admins.
- **Messaging Enhancements**: Added copy/delete message context menu, pin chats feature with localStorage persistence, improved archive layout.
- **Unread Message Badge**: Red badge with count on messages icon in header and bottom navigation with real-time updates.
- **Email Notifications**: Enhanced email templates for order messages, replies, and first-contact scenarios.
- **The Plug Redesign**: Twitter/X-style UI with floating compose button, drafts feature (localStorage), card-based post layout (avatar left, content right).

## System Architecture

The marketplace employs a modern full-stack architecture focused on performance, security, and user experience, built with React, TypeScript, and Express.js.

**UI/UX Decisions:**
- **Design System:** Shadcn UI + Tailwind CSS for a responsive, mobile-first design with full dark mode support.
- **Real-Time Features:** WhatsApp-inspired chat UI, real-time status updates, and a social feed ("The Plug") with X/Twitter-style interaction.
- **Safety Features:** Safety Shield Modal, enhanced seller cards with trust scores, and an auto-follow system for new users to receive safety tips from a system account.
- **Navigation:** Enhanced bottom navigation and header with dedicated links and unread badges.
- **Interaction:** Haptic feedback, pull-to-refresh, and back-to-top functionality.
- **Theming:** Support for 8 distinct themes (light, dim, lights-out, sunset, ocean, forest, sepia, high-contrast) with full CSS variable integration.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Wouter for routing, TanStack Query for data fetching, WebSockets for real-time communication, optimized with lazy loading and skeleton loaders.
- **Backend:** Express.js, PostgreSQL with Drizzle ORM, Passport.js for authentication, and a WebSocket server.
- **Authentication:** Email/password, role-based access control (buyer/seller/admin/support), session management, and email verification with code/token options.
- **Products:** Multi-image uploads, advanced search/filter, seller dashboards, and admin moderation.
- **Chat:** WebSocket-based messaging with rich features like image sharing, voice input, message deletion, copy, pin, and archive.
- **User Management:** Editable profiles, verification badges, trust scores, sales history, reporting, and a virtual wallet with escrow.
- **Admin Panel:** Comprehensive moderation, analytics, revenue tracking, and support ticket management.
- **AI Chatbot:** Groq-powered with payment scam detection, safety warnings, quick help, Nigerian language support, and smart handoff to human support.
- **Payment System:** Squad/Habari integration for Card, Bank Transfer, USSD with instant settlements, fee calculation, and bank verification.
- **Order Management:** 11 delivery statuses with audit trails, role-based permissions, and escrow.
- **Security:** Role-based access control, user verification, reporting, and HTTPS.
- **Location Services:** Geolocation for campus detection and location-aware feeds.
- **KYC Verification:** Multi-step wizard with ID and liveness detection.
- **VTU Platform (Inlomax API):** Comprehensive VTU service with:
  - Data bundles and airtime for MTN, GLO, Airtel, 9mobile with competitive pricing
  - 3-tier reseller system (Starter ₦5k, Business ₦15k, Enterprise ₦50k) with custom pricing
  - Scheduled purchases (daily/weekly/monthly) with auto-execution
  - Bulk VTU purchases with CSV upload support for multiple recipients
  - Gift data functionality for sending data to friends
  - Transaction export (PDF/Excel) with date range filtering
  - Rewards/cashback points system (10 pts per ₦1,000 spent, tier-based multipliers)
  - Savings calculator showing ROI and discounts vs market prices
  - Beneficiary management for quick recharge
  - **API Access for Resellers:** Animated "hacker-style" terminal interface for generating API credentials with:
    - Black terminal background with green/cyan text typing animations
    - Security warnings and confirmation steps
    - Public API Key, Secret Key, and Webhook Secret generation
    - Admin-free access (no payment required for admins)
    - One-time ₦5,000 fee for non-admin users
    - API documentation with endpoint reference (data/airtime purchase, balance, transactions)
    - Rate limiting (100 requests/minute, 10,000/day)
    - Credential revocation and regeneration functionality
- **PWA Support:** Service worker for offline caching and install prompt.
- **Support Ticket System:** Threaded conversations with status tracking.
- **Social Features:** "The Plug" feed for posts (X-style), confessions page with voting, and a "Secret Messages Hub" for anonymous communication.
- **Educational Resources:** Study Materials feature for buying/selling academic resources (past questions, handouts) with a revenue split.
- **Hostel & Roommate Finder:** Listings with filters, amenities, agent contact, and distance from campus.
- **Game Library:** Integration of 15+ multiplayer betting games (Ludo, Whot, Chess, Aviator, etc.) with wallet integration and real-time WebSocket support.

**System Design Choices:**
- **Database Schema:** Structured for Users, Products, Categories, Messages, Reviews, Watchlist, Reports, Support Tickets, KYC, Sponsored Ads, Games, Study Materials, and Hostels.
- **File Structure:** `client/` for frontend, `server/` for backend, `shared/` for common utilities.
- **API Endpoints:** Organized by functionality.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Groq API:** For AI Chatbot (`llama-3.3-70b-versatile`).
- **Squad/Habari API:** Payment gateway for Card, Bank Transfer, USSD transactions.
- **Passport.js:** Authentication middleware.
- **Drizzle ORM:** Database interaction layer.
- **Socket.io-like WebSocket:** Real-time communication.
- **Multer:** For handling multi-part form data, primarily image uploads.
- **Inlomax API:** For Virtual Top-Up (VTU) data, airtime, cable TV, electricity bills, and exam pins sales.
- **Resend Email API:** Primary email service (with Brevo, Gmail, Mailgun fallbacks).
- **Render:** Recommended deployment platform.
