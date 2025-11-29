# EKSU Campus Marketplace

## Overview

The EKSU Campus Marketplace is a secure and efficient platform for Ekiti State University (EKSU) students to buy and sell items. It aims to be the leading campus marketplace by fostering a safe trading environment and generating revenue through featured listings, transaction fees, and premium subscriptions. Key capabilities include real-time communication, a robust trust system, role-based access, advanced safety features, and integrated financial services.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

The marketplace employs a modern full-stack architecture focusing on performance, security, and user experience.

**UI/UX Decisions:**
- **Design System:** Shadcn UI + Tailwind CSS for a responsive, mobile-first design with full dark mode support.
- **Real-Time Features:** WhatsApp-inspired chat UI, real-time status updates, and X/Twitter-style "The Plug" feed with engagement tracking.
- **Safety Features:** Safety Shield Modal, enhanced seller cards with trust scores, and an auto-follow system for new users to receive safety tips from the "Campus Hub" system account.
- **Navigation:** Enhanced bottom navigation and header with dedicated links.
- **Interaction:** Haptic feedback, pull-to-refresh, and back-to-top functionality.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Wouter for routing, TanStack Query for data fetching, and WebSockets for real-time communication. Performance optimizations include lazy loading and skeleton loaders.
- **Backend:** Express.js, PostgreSQL with Drizzle ORM, Passport.js for authentication, and a WebSocket server.
- **Authentication:** Email/password with role selection, session management, and protected routes.
- **Products:** Multi-image uploads, search/filter, seller dashboard, and admin moderation.
- **Chat:** WebSocket-based messaging with advanced features like image lightbox, voice input, and message deletion.
- **User Management:** Editable profiles, verification badges, trust scores, sales history, user blocking/reporting, and a virtual wallet with escrow support. KYC verification is implemented with ID and liveness detection.
- **Admin Panel:** Comprehensive moderation, analytics, revenue tracking, and support ticket management.
- **AI Chatbot:** Groq-powered with payment scam detection, safety warnings, quick help buttons, Nigerian language support, and smart handoff to human support.
- **Payment System:** Squad/Habari integration for Card, Bank Transfer, USSD with instant settlements and bank verification.
- **Order Management:** 11 delivery statuses with audit trails, role-based permissions, and escrow.
- **Security:** Role-based access control, user verification, reporting, admin moderation, and HTTPS.
- **Location Services:** Geolocation with IP fallback, campus detection, and location-aware feeds.
- **VTU Data Sales:** Integrated SMEDATA.NG API for data resale with phone number validation.
- **PWA Support:** Service worker for offline caching.
- **Support Ticket System:** Threaded conversations and status tracking.
- **Social Post Reporting:** User reporting with auto-hiding functionality.
- **Gaming Platform:** Integrated 15+ multiplayer betting games (e.g., Ludo, Whot, Chess Blitz, Aviator) with wallet integration and secure random number generation.
- **Secret Messages Hub:** Anonymous messaging system with auto-refresh and ghost branding.
- **Study Materials:** Feature for buying/selling academic materials (past questions, handouts) with wallet purchases and a rating system.
- **Hostel & Roommate Finder:** Listings with multi-image support, filtering by location, amenities, and price.

**System Design Choices:**
- **Database Schema:** Structured for Users, Products, Categories, Messages, Reviews, Watchlist, Reports, Support Tickets, KYC, Sponsored Ads, Games, Study Materials, and Hostels.
- **File Structure:** `client/` for frontend, `server/` for backend, `shared/` for common utilities.
- **API Endpoints:** Organized by functionality.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Groq API:** For AI Chatbot (`llama-3.3-70b-versatile`).
- **Squad/Habari API:** Payment gateway.
- **Passport.js:** Authentication middleware.
- **Drizzle ORM:** Database interaction.
- **Socket.io-like WebSocket:** Real-time communication.
- **Multer:** Image uploads.
- **SMEDATA.NG API:** For Virtual Top-Up (VTU) data sales.
- **Resend Email API:** Primary email service with Brevo, Gmail, Mailgun fallbacks.
- **Render:** Recommended deployment platform.