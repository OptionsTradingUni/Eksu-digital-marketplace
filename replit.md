# EKSU Campus Marketplace

## Overview

The EKSU Campus Marketplace is a secure and efficient platform for Ekiti State University (EKSU) students to buy and sell items. It aims to be the leading campus marketplace, fostering a safe trading environment and generating revenue through featured listings, transaction fees, and premium subscriptions. Key capabilities include real-time communication, a robust trust system, role-based access, advanced safety features, and a variety of social and utility features. The platform is designed to be a comprehensive campus hub for commerce, social interaction, and essential services.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

The marketplace employs a modern full-stack architecture focused on performance, security, and user experience, built with React, TypeScript, and Express.js.

**UI/UX Decisions:**
- **Design System:** Shadcn UI + Tailwind CSS for a responsive, mobile-first design with full dark mode support.
- **Real-Time Features:** WhatsApp-inspired chat UI, real-time status updates, and a social feed ("The Plug") with X/Twitter-style interaction.
- **Safety Features:** Safety Shield Modal, enhanced seller cards with trust scores, and an auto-follow system for new users to receive safety tips from a system account.
- **Navigation:** Enhanced bottom navigation and header with dedicated links.
- **Interaction:** Haptic feedback, pull-to-refresh, and back-to-top functionality.
- **Theming:** Support for 8 distinct themes (light, dim, lights-out, sunset, ocean, forest, sepia, high-contrast) with full CSS variable integration.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Wouter for routing, TanStack Query for data fetching, WebSockets for real-time communication, optimized with lazy loading and skeleton loaders.
- **Backend:** Express.js, PostgreSQL with Drizzle ORM, Passport.js for authentication, and a WebSocket server.
- **Authentication:** Email/password, role-based access control (buyer/seller/admin/support), session management, and email verification.
- **Products:** Multi-image uploads, advanced search/filter, seller dashboards, and admin moderation.
- **Chat:** WebSocket-based messaging with rich features like image sharing, voice input, and message deletion.
- **User Management:** Editable profiles, verification badges, trust scores, sales history, reporting, and a virtual wallet with escrow.
- **Admin Panel:** Comprehensive moderation, analytics, revenue tracking, and support ticket management.
- **AI Chatbot:** Groq-powered with payment scam detection, safety warnings, quick help, Nigerian language support, and smart handoff to human support.
- **Payment System:** Squad/Habari integration for Card, Bank Transfer, USSD with instant settlements, fee calculation, and bank verification.
- **Order Management:** 11 delivery statuses with audit trails, role-based permissions, and escrow.
- **Security:** Role-based access control, user verification, reporting, and HTTPS.
- **Location Services:** Geolocation for campus detection and location-aware feeds.
- **KYC Verification:** Multi-step wizard with ID and liveness detection.
- **VTU Data Sales:** Integrated SMEDATA.NG API for data and airtime resale with wallet integration and refund logic.
- **PWA Support:** Service worker for offline caching and install prompt.
- **Support Ticket System:** Threaded conversations with status tracking.
- **Social Features:** "The Plug" feed for posts, confessions page with voting, and a "Secret Messages Hub" for anonymous communication.
- **Educational Resources:** Study Materials feature for buying/selling academic resources (past questions, handouts) with a revenue split.
- **Hostel & Roommate Finder:** Listings with filters, amenities, agent contact, and distance from campus.
- **Game Library:** Integration of 15+ multiplayer betting games (Ludo, Whot, Chess, Aviator, etc.) with wallet integration and real-time WebSocket support.

**System Design Choices:**
- **Database Schema:** Structured for Users, Products, Categories, Messages, Reviews, Watchlist, Reports, Support Tickets, KYC, Sponsored Ads, Games, Study Materials, and Hostels.
- **File Structure:** `client/` for frontend, `server/` for backend, `shared/` for common utilities.
- **API Endpoints:** Organized by functionality (Auth, Products, Messages, Users, Admin, Categories, Watchlist, Reviews, Chatbot, Error Reporting, Support, VTU).

## External Dependencies

- **PostgreSQL:** Primary database.
- **Groq API:** For AI Chatbot (`llama-3.3-70b-versatile`).
- **Squad/Habari API:** Payment gateway for Card, Bank Transfer, USSD transactions.
- **Passport.js:** Authentication middleware.
- **Drizzle ORM:** Database interaction layer.
- **Socket.io-like WebSocket:** Real-time communication.
- **Multer:** For handling multi-part form data, primarily image uploads.
- **SMEDATA.NG API:** For Virtual Top-Up (VTU) data and airtime sales.
- **Resend Email API:** Primary email service (with Brevo, Gmail, Mailgun fallbacks).
- **Render:** Recommended deployment platform.