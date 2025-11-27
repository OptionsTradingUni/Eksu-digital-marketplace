# EKSU Campus Marketplace

## Overview

A comprehensive marketplace platform for EKSU students to buy and sell items safely on campus. The platform aims to provide a secure and efficient environment for campus commerce, featuring real-time communication, a robust trust system, and role-based access.

**Business Vision & Ambition:** To be the leading campus marketplace for EKSU students, fostering a secure trading environment and offering diverse revenue streams through features like featured listings, transaction fees, and premium subscriptions.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

The EKSU Campus Marketplace is built with a modern full-stack architecture.

**UI/UX Decisions:**
- **Design System:** Shadcn UI + Tailwind CSS for a consistent, accessible, and responsive (mobile-first) design.
- **Color Scheme:** Primary green to convey trust and marketplace theme.
- **Typography:** Inter font.
- **Theming:** Full dark mode support with persistent user preference.
- **Real-Time Features:** WhatsApp-inspired UI for chat, real-time status updates.
- **Safety Features:** Safety Shield Modal, enhanced seller cards displaying trust scores and verification, and an auto-follow system for new users to receive safety tips.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Wouter for routing, TanStack Query for data fetching, and a WebSocket client for real-time communication.
- **Backend:** Express.js, PostgreSQL with Drizzle ORM, Passport.js for authentication, a WebSocket server, and Multer for image uploads.
- **Authentication:** Email/password authentication with role selection (buyer/seller) during registration, session management, and protected routes.
- **Products:** Multi-image uploads (up to 10 images), search/filter capabilities, seller dashboard, and admin moderation.
- **Real-Time Chat:** WebSocket-based messaging with message threads and online/offline status.
- **User Profiles:** Editable profiles, verification badges, trust scores, and sales history.
- **Admin Panel:** User and product moderation, platform analytics, and revenue tracking.
- **AI Chatbot:** Powered by Groq (llama-3.3-70b-versatile) with features like automatic payment scam detection, safety warnings, quick help buttons, and Nigerian language support (Pidgin, Yoruba, Igbo, English).
- **Error Handling:** Multi-level error boundaries, user-friendly error UI, and global error handlers with backend reporting.
- **Wallet System:** Virtual wallet, welcome bonuses, transaction history, and escrow support.
- **Referral System:** Earning rewards for successful signups.
- **Role Switcher:** Users can dynamically switch between buyer, seller, and admin modes.
- **Login Streak Rewards:** Daily rewards for consistent platform engagement.
- **System Account (Campus Hub):** An official marketplace account that auto-follows new users, sends welcome messages, and can post announcements in "The Plug" social feed. Regular users cannot follow back or message this account.
- **Squad/Habari Payment Integration:** Comprehensive payment processing (Card, Bank Transfer, USSD) with instant settlement (T+0) for bank transfers, fee calculation, seller payouts, and bank verification. Payment callbacks handled via `/payment/callback` route.
- **Order Management System:** 11 delivery statuses with full audit trail, role-based permissions, unique order numbers, delivery method selection, and escrow integration.
- **Security:** Role-based access control, user verification, trust scores, reporting mechanisms, admin moderation, session management, and HTTPS enforcement. Admin/Support roles are managed via environment variables and database flags.

**System Design Choices:**
- **Database Schema:** Defined for Users, Products, Categories, Messages, Reviews, Watchlist, and Reports, supporting the core marketplace functionalities.
- **File Structure:** Organized `client/` for frontend, `server/` for backend logic, and `shared/` for common schemas and utilities.
- **API Endpoints:** Structured for Auth, Products, Messages, Users, Admin, Categories, Watchlist, Reviews, Chatbot, and Error Reporting.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Groq API:** For the AI Chatbot (`llama-3.3-70b-versatile`).
- **Squad/Habari API:** Payment gateway for transactions, payouts, and bank verification. Environment variables: `SQUAD_SECRET_KEY`, `SQUAD_PUBLIC_KEY`.
- **Passport.js:** Authentication middleware.
- **Drizzle ORM:** Database interaction.
- **Socket.io-like WebSocket:** Real-time communication.
- **Multer:** For handling multi-part form data, specifically image uploads.
- **Render:** Recommended deployment platform, handling PostgreSQL and environment variables.

## System Account Setup

The EKSU Marketplace includes an official system account ("Campus Hub") that provides:
- Welcome messages to new users
- Auto-follow relationship with all new users
- Ability to post official announcements in "The Plug" social feed
- Protection against regular users following back or messaging

**Setup Steps:**
1. Run `npm run db:seed-system` to create the system account (if not already created)
2. The script generates credentials and saves them to `SYSTEM_ACCOUNT_CREDENTIALS.md`
3. The `SYSTEM_USER_ID` environment variable is set automatically

**Environment Variables:**
- `SYSTEM_USER_ID`: The UUID of the system account (required for auto-follow and welcome messages)

**Security Notes:**
- The credentials file is excluded from git via `.gitignore`
- Regular users cannot follow the system account (auto-followed on registration)
- Regular users cannot send messages to the system account