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
- Replit Auth (email/password + Google login)
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

### Authentication (Replit Auth)
- Email/password and Google login
- Role selection during registration (buyer/seller)
- Session management with PostgreSQL store
- Protected routes with middleware

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

Required secrets (already configured):
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption
- `REPL_ID` - Replit app ID
- `ISSUER_URL` - OIDC issuer (defaults to Replit)

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
  replitAuth.ts     # Authentication setup
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

## Future Enhancements (Phase 2)

- Stripe/Paystack payment integration with escrow (3-6% fee)
- Student ID & NIN verification (YouVerify/Dojah)
- AI-powered scam detection
- Featured/boosted listings (₦500-₦2,000)
- Premium seller subscriptions (₦3,000-₦5,000/semester)
- Video uploads for products
- Push notifications
- Wishlist with price drop alerts
- Banner ad management
- Seller analytics dashboard
- Multi-language support
- USSD payment fallback

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
