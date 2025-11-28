# EKSU Campus Marketplace

A comprehensive peer-to-peer marketplace built specifically for EKSU students to buy and sell items, find hostels, connect with services, and more.

## Features

- **Student Verification**: NIN-based identity verification with selfie matching
- **Secure Payments**: Squad (by Habari/GTBank) payment gateway with multiple channels (Card, Bank Transfer, USSD)
- **Smart Wallet System**: Deposit, withdraw, track balances with escrow protection
- **Real-Time Chat**: WebSocket messaging with image & voice note support
- **Referral Rewards**: Earn bonuses when referred users make purchases
- **Login Streak Rewards**: Daily login bonuses
- **Welcome Bonus**: Random welcome bonus for new users
- **Hostel Rentals**: Connect tenants with agents, platform takes commission
- **Account Selling**: Safe marketplace for digital accounts with fraud prevention
- **Event Posting**: Promote concerts, parties, campus events
- **Trust System**: Verified seller badges, ratings, leaderboards
- **Admin Dashboard**: Manual verification, dispute resolution, user management

---

## Environment Variables Setup

This app requires several environment variables to work properly.

### Required Variables

```bash
# Database (Auto-configured by Replit)
DATABASE_URL=your_postgresql_connection_string

# Session Security
SESSION_SECRET=your_random_32_char_string_here

# Squad Payment Gateway (by Habari/GTBank)
SQUAD_SECRET_KEY=sk_live_your_secret_key_here
SQUAD_PUBLIC_KEY=pk_live_your_public_key_here
```

---

### Squad Payment Gateway Setup

#### Get Your Squad API Keys

1. Create a free account at https://squadco.com
2. Complete your business verification
3. Go to Settings -> API Keys
4. Copy your **Secret Key** and **Public Key**

**For Testing (Sandbox):**
- Use sandbox keys that start with `sandbox_sk_` and `sandbox_pk_`
- Create sandbox account at https://sandbox.squadco.com

**For Production (Live):**
- Use live keys (start with regular prefixes)
- Base URL automatically switches to production mode

**Example Configuration:**
```bash
# Sandbox/Testing
SQUAD_SECRET_KEY=sandbox_sk_1234567890abcdefghijklmnopqrstuvwxyz
SQUAD_PUBLIC_KEY=sandbox_pk_abcdefghijklmnopqrstuvwxyz1234567890

# Production
SQUAD_SECRET_KEY=sk_1234567890abcdefghijklmnopqrstuvwxyz
SQUAD_PUBLIC_KEY=pk_abcdefghijklmnopqrstuvwxyz1234567890
```

---

### Optional: NIN Verification

For identity verification, you need either Korapay or Dojah:

**Option A: Korapay (Recommended)**
```bash
KORAPAY_API_KEY=your_korapay_api_key_here
```
- Sign up at https://korapay.com
- Cost: ~N20-30 per verification

**Option B: Dojah**
```bash
DOJAH_API_KEY=your_dojah_api_key_here
```
- Sign up at https://dojah.io
- Similar pricing to Korapay

---

## Complete Environment Variables Checklist

```bash
# CRITICAL - Must have these
SESSION_SECRET=your_random_32_char_string_here
DATABASE_URL=postgresql://user:pass@host:port/db

# Squad Payment Gateway
SQUAD_SECRET_KEY=your_squad_secret_key
SQUAD_PUBLIC_KEY=your_squad_public_key

# NIN Verification (Choose one)
KORAPAY_API_KEY=your_korapay_key
# OR
DOJAH_API_KEY=your_dojah_key

# Optional
NODE_ENV=production
FRONTEND_URL=https://your-app-domain.com
```

---

## How to Set Environment Variables

### In Replit:
1. Click on "Secrets" (lock icon) in left sidebar
2. Add key-value pairs
3. These are automatically loaded as environment variables

### In Railway:
1. Open your project
2. Click on your deployment
3. Go to "Variables" tab
4. Click "New Variable" for each one
5. Add name and value
6. Railway will auto-redeploy with new variables

---

## Payment Features

### Supported Payment Methods (via Squad)
- **Card**: Visa, Mastercard, Verve
- **Bank Transfer**: Direct transfer to virtual account
- **USSD**: Works with major Nigerian banks
- **Direct Debit**: For recurring payments

### Payment Flow
1. User initiates deposit from wallet
2. Backend creates Squad payment request
3. User is redirected to Squad checkout page
4. Payment is processed via chosen method
5. Webhook confirms payment to backend
6. User wallet is credited automatically

### Withdrawals
1. User requests withdrawal from wallet
2. Bank account is verified via Squad API
3. Transfer is initiated to user's bank
4. Funds arrive in 1-24 hours (depending on bank)

---

## Cost Breakdown

### Free Services:
- **Hosting**: Replit (development) / Railway (production)
- **Database**: PostgreSQL (included with hosting)
- **Squad**: Free account, pay per transaction

### Transaction Fees:
- **Squad Gateway**: ~1.5% per transaction (capped at N2,000)
- **Transfer API**: 0.1% per transfer or flat fee

### Paid Services:
- **NIN Verification**: N20-30 per verification

---

## Project Structure

```
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/      # Route pages
│   │   ├── components/ # Reusable components
│   │   └── lib/        # Utilities
├── server/             # Express backend
│   ├── index.ts        # Server entry
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Database interface
│   ├── squad.ts        # Squad payment integration
│   └── replitAuth.ts   # Authentication
├── shared/             # Shared types & schemas
│   └── schema.ts       # Database schema & Zod schemas
└── uploads/            # User uploaded images
```

---

## Squad API Integration

The platform uses Squad (by Habari/GTBank) as the sole payment provider.

### Key Endpoints Used:
- `POST /transaction/initiate` - Initialize payment
- `GET /transaction/verify/:ref` - Verify transaction
- `POST /payout/account/lookup` - Verify bank account
- `POST /payout/transfer` - Initiate withdrawal
- `GET /payout/banks/all` - Get list of banks

### Webhook Setup:
Configure your Squad webhook URL to:
```
https://your-domain.com/api/squad/webhook
```

---

## Security & Legal Compliance

### NIN Data Protection (IMPORTANT)
You CANNOT store raw 11-digit NIN numbers (illegal under Nigerian law since Dec 2021)

**What you CAN do:**
- Store verification results (verified: true/false)
- Store confidence scores from selfie matching
- Store user consent records

**What you CANNOT do:**
- Store the actual NIN number
- Share NIN data with third parties
- Use NIN for purposes other than verification

### NDPR Compliance
Your app must comply with Nigeria Data Protection Regulation:
- Privacy Policy page (required)
- User consent for data collection
- Terms & Conditions
- Dispute resolution process

---

## Quick Start Guide

1. **Clone and Install**:
   ```bash
   git clone <your-repo>
   cd eksu-marketplace
   npm install
   ```

2. **Set Up Environment**:
   - Add required environment variables to Replit Secrets or `.env` file

3. **Run Database Migration**:
   ```bash
   npm run db:push
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Open in Browser**:
   - App runs on `http://localhost:5000`

---

## Testing Payment Integration

### Squad Test Mode:
1. Use sandbox keys (start with `sandbox_sk_`)
2. Test cards work in sandbox mode
3. No real money is charged

### Test Cards (Sandbox):
```
Success: 4242 4242 4242 4242
Any CVV: 123
Any future expiry: 12/30
```

---

## Support

If you encounter issues:
1. Check that all environment variables are set correctly
2. Verify your Squad account is properly configured
3. Make sure DATABASE_URL is accessible
4. Check server logs for error details

---

## License

MIT License - Feel free to modify and use for your campus marketplace!

---

**Built for EKSU students, by students. Trade safely, study hard!**
