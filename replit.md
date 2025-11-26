# EKSU Campus Marketplace

A comprehensive marketplace platform for EKSU students to buy and sell items safely on campus.

## Overview

This platform enables students to:
- **Buy & Sell**: List products with images, prices, descriptions, and categories
- **Real-Time Chat**: Communicate instantly with buyers/sellers via WebSocket
- **Trust System**: User verification badges, ratings, and trust scores
- **Role-Based Access**: Separate experiences for buyers, sellers, and admins
- **Dark Mode**: Toggle between light and dark themes with persistent preference

## Tech Stack

**Frontend:**
- React + TypeScript
- Wouter (routing)
- TanStack Query (data fetching)
- Shadcn UI + Tailwind CSS (design system)
- WebSocket client (real-time chat)

**Backend:**
- Express.js
- PostgreSQL + Drizzle ORM
- Passport.js Auth (email/password authentication)
- WebSocket server (Socket.io-like real-time messaging)
- Multer (image uploads)

## Database Schema

**Users**: id, email, firstName, lastName, role (buyer/seller/admin), verification status, trust score, ratings
**Products**: id, sellerId, categoryId, title, description, price, images[], condition, location, availability
**Categories**: 10 default categories (Electronics, Textbooks, Fashion, Furniture, etc.)
**Messages**: Real-time chat between users
**Reviews**: Ratings and feedback for users
**Watchlist**: Save favorite products
**Reports**: Flag suspicious listings/users

## Key Features Implemented

### Authentication (Passport.js)
- Email/password authentication
- Role selection during registration (buyer/seller)
- Session management with PostgreSQL store
- Protected routes with middleware
- Secure cookie configuration for Render deployment

### Products
- Create listings with multi-image upload (up to 10 images)
- Search and filter by category, price, condition, location
- View tracking and analytics
- Seller dashboard with product management
- Admin moderation queue

### Real-Time Chat
- WebSocket-based messaging
- Message threads with unread counts
- Online/offline status
- WhatsApp-inspired UI

### User Profiles
- Edit profile information
- Verification badges
- Trust scores and ratings
- Sales history

### Admin Panel
- User management (verify/ban)
- Product moderation (approve/flag)
- Platform analytics
- Revenue tracking (ready for monetization)

## API Endpoints

### Auth
- `GET /api/login` - Initiate login
- `GET /api/logout` - Logout
- `GET /api/auth/user` - Get current user

### Products
- `GET /api/products` - List all products (with filters)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create listing (with image upload)
- `PUT /api/products/:id` - Update listing
- `DELETE /api/products/:id` - Delete listing
- `GET /api/products/my-listings` - Seller's products

### Messages
- `GET /api/messages/threads` - Get chat threads
- `GET /api/messages/:userId` - Get messages with user
- `POST /api/messages` - Send message

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile

### Admin
- `GET /api/admin/users` - All users
- `PUT /api/admin/users/:id/verify` - Verify user
- `PUT /api/admin/users/:id/ban` - Ban user
- `GET /api/admin/products` - All products
- `PUT /api/admin/products/:id/approve` - Approve product

### Categories
- `GET /api/categories` - List all categories

### Watchlist
- `GET /api/watchlist` - User's watchlist
- `POST /api/watchlist` - Add to watchlist

### Reviews
- `GET /api/reviews/:userId` - User's reviews
- `POST /api/reviews` - Create review

### Error Reporting
- `POST /api/errors/report` - Report frontend errors (logs to console, optional email notifications)

## Running the Project

```bash
# Install dependencies (already done)
npm install

# Push database schema
npm run db:push

# Seed categories
npx tsx server/seed.ts

# Start development server
npm run dev
```

The app runs on port 5000 and includes both backend API and frontend SPA.

## Environment Variables

Required secrets for Render deployment:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key (generate with `openssl rand -base64 32`)
- `GROQ_API_KEY` - AI chatbot API key (get FREE at console.groq.com)
- `NODE_ENV` - Set to `production` for Render deployment

## File Structure

```
client/
  src/
    components/     # Reusable UI components
    pages/          # Route pages
    hooks/          # Custom hooks (useAuth, useTheme)
    contexts/       # React contexts (ThemeContext)
    lib/            # Utilities (queryClient, authUtils)
server/
  db.ts             # Database connection
  storage.ts        # Data access layer
  routes.ts         # API endpoints + WebSocket
  auth.ts           # Passport.js authentication setup
  seed.ts           # Database seeding
shared/
  schema.ts         # Drizzle schema + Zod validation
```

## Design System

- **Primary Color**: Green (marketplace/trust theme)
- **Font**: Inter (Google Fonts)
- **Dark Mode**: Full support with persistent preference
- **Responsive**: Mobile-first design optimized for Nigerian students
- **Components**: Shadcn UI for consistent, accessible components

## AI Chatbot (NEW - November 25, 2025) ✨

### Smart AI Assistant
- **Powered by Groq** (llama-3.3-70b-versatile) - 100% FREE API
- Understands Nigerian languages: Pidgin, Yoruba, Igbo, English
- Knows ALL marketplace operations (buying, selling, escrow, verification, etc.)
- Personality: Friendly, sassy with scammers, helpful always

### Key Features
- **Automatic Payment Scam Detection**: Alerts users when sellers ask for outside-app payments
- **Big Red Safety Warnings**: "We're not responsible for transactions outside the app!"
- **Quick Help Buttons**: How to Sell, Safety Tips, How Escrow Works, Get Verified
- **Nigerian Language Support**: Speaks naturally in Pidgin, responds in user's language
- **Security Hardened**: Server-side message validation, 2000 char limit, Zod validation

### API Endpoints
- `POST /api/chatbot` - Chat with AI (single message, returns response + scam warning flag)
- `GET /api/chatbot/quick-help` - Get pre-defined helpful responses

### Security Features
- Only accepts single user messages (prevents conversation history spoofing)
- Server-side scam detection (client can't bypass warnings)
- Input validation with Zod (max 2000 characters)
- Rate limiting ready (future enhancement)

### Environment Variables Required
```bash
GROQ_API_KEY=your_groq_api_key_here  # Get FREE at console.groq.com
```

## Error Handling System (November 25, 2025)

### Comprehensive Error Boundaries
- **Multi-level ErrorBoundary**: Wraps entire app and each individual route
- **User-friendly error UI**: Shows clear error messages with technical details
- **Copy to clipboard**: Users can copy error details for support
- **Multiple recovery options**: Try again, reload page, or go home
- **Global error handlers**: Catches uncaught errors and unhandled promise rejections
- **Backend error reporting**: `/api/errors/report` endpoint logs all frontend errors

### Email Notifications (TODO)
To enable email notifications for errors:
1. Set up Resend integration OR provide SMTP credentials
2. Add email sending logic to `/api/errors/report` endpoint in `server/routes.ts`
3. Set environment variable `ERROR_EMAIL_RECIPIENT` with your email address

## Recently Added Features (November 2025)

### Wallet System
- Virtual wallet for each user with balance tracking
- Automatic welcome bonus (₦300-₦1,000) on signup
- Transaction history with full audit trail
- Escrow support for secure transactions

### Referral System  
- Share referral links and earn ₦500 per successful signup
- Automatic bonus payment to wallet
- Track all referrals and earnings

### Role Switcher
- Users can switch between buyer, seller, and admin modes
- Instant role switching via API
- Automatic seller analytics creation for sellers

### Login Streak Rewards
- Daily login rewards from ₦50 to ₦1,000
- Streak tracking (current and longest)
- Automatic wallet crediting

### Advanced Search Features
- Save searches with price alerts
- Get notified when prices drop
- Search history tracking

### Seller Tools
- Draft product listings (save for later)
- Scheduled posting (post at specific time)
- Boost/featured listings with payment
- Seller analytics dashboard
- Best posting time suggestions

### Voice Posting (Ready for Integration)
- Database support for voice transcriptions
- Multi-language support (Pidgin, Yoruba, Igbo, Hausa, English)
- Audio file storage

### Support & Disputes
- Support ticket system with priority levels
- Dispute resolution center
- Photo evidence upload
- Admin resolution tracking

## Deployment

### Railway Deployment (Recommended)
See `RAILWAY_DEPLOYMENT.md` for complete Railway setup guide.

**Quick Steps:**
1. Push to GitHub
2. Create Railway project from repo
3. Add PostgreSQL database
4. Set environment variables (DATABASE_URL, GROQ_API_KEY, SESSION_SECRET)
5. Deploy - Railway handles everything automatically!

**Cost:** FREE tier includes 500 hours/month + PostgreSQL

### Local Development (Replit)
1. Clone/fork the repo
2. Add secrets in Replit Secrets panel
3. Run `npm install`
4. Run `npm run db:push` to create database tables
5. Run `npm run dev` - app runs on port 5000

## Monnify Payment Integration (November 26, 2025)

### Payment Gateway
- **Full Monnify Integration** - Sandbox/Live support with automatic token caching
- **Multiple Payment Methods**: Card, Bank Transfer, USSD
- **Fee Calculation**: 1.5% for cards, 1.0% for bank transfers (capped at ₦2,000)

### Payment Features
- `POST /api/monnify/initialize` - Start a payment transaction
- `GET /api/monnify/verify/:reference` - Verify payment status
- `POST /api/monnify/webhook` - Receive payment notifications (signature verified)
- `POST /api/monnify/withdraw` - Initiate seller payout via disbursement API
- `POST /api/monnify/verify-bank` - Validate bank account before withdrawal
- `GET /api/monnify/banks` - List all supported Nigerian banks

### Pricing System
- Platform commission: 10% (configurable via WEBSITE_COMMISSION_RATE)
- Automatic fee calculation for buyers
- Seller earnings = Product Price - Platform Commission
- Security deposit locking for first-time sellers

### Environment Variables Required
```bash
MONNIFY_API_KEY=MK_TEST_xxx        # Your Monnify API key
MONNIFY_SECRET_KEY=xxx             # Your Monnify secret key
MONNIFY_CONTRACT_CODE=xxxxxxxx    # Your Monnify contract code
MONNIFY_ENVIRONMENT=SANDBOX        # or LIVE for production
```

## Order Management System (November 26, 2025)

### Order Tracking
- **11 Delivery Statuses**: pending → paid → seller_confirmed → preparing → ready_for_pickup → shipped → out_for_delivery → delivered → buyer_confirmed → completed → cancelled
- **Status History**: Full audit trail of all status changes
- **Role-based Permissions**: Buyers and sellers can only update statuses they're allowed to

### Order API Endpoints
- `POST /api/orders` - Create a new order
- `GET /api/orders/buyer` - Get buyer's orders
- `GET /api/orders/seller` - Get seller's orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/orders/:id/history` - Get order status history

### Order Features
- Unique order numbers (EKSU-xxxx-xxxx format)
- Delivery method selection (campus meetup, hostel, courier)
- Delivery address and notes tracking
- Timeline tracking for each status change
- Escrow transaction integration
- Negotiation support for agreed prices

## Future Enhancements (Phase 2)

- ✅ AI Chatbot with Nigerian language support (COMPLETED)
- ✅ Payment scam detection and warnings (COMPLETED)
- ✅ Monnify Payment Integration (COMPLETED)
- ✅ Order Management System (COMPLETED)
- Student ID & NIN verification (YouVerify/Dojah)
- Advanced AI scam detection (listing analysis)
- Video uploads for products
- Push notifications
- Instant search (<300ms with Nigerian slang support)
- Voice-to-text posting UI
- Multi-language support UI
- USSD payment fallback
- AI listing generation from photos + voice
- Server-side conversation history for chatbot

## Revenue Model

The platform is designed to support multiple revenue streams:
1. Featured listings and boosts
2. Transaction fees via escrow
3. Premium seller subscriptions
4. Banner advertisements
5. Promoted notifications

## Security Features

- Role-based access control
- User verification system
- Trust scores and ratings
- Report and flagging system
- Admin moderation tools
- Session management with PostgreSQL
- Prepared for NIN/BVN verification

## Notes

- All images uploaded to `/uploads` directory
- WebSocket server on `/ws` path
- Maximum 10 images per product listing
- 5MB file size limit per image
- Database automatically created via Replit integration
