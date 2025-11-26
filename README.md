# EKSU Campus Marketplace

<div align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=optionstradinguni&show_icons=true&theme=radical" height="180" alt="stats graph"  />
  <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=your-username&layout=compact&theme=radical" height="180" alt="languages graph"  />
</div>


A comprehensive peer-to-peer marketplace built specifically for EKSU students to buy and sell items, find hostels, connect with services, and more.

## 🚀 Features

- **Student Verification**: NIN-based identity verification with selfie matching
- **Secure Payments**: Paystack integration with escrow protection
- **Smart Wallet System**: Deposit, withdraw, track balances
- **Real-Time Chat**: WebSocket messaging with image & voice note support
- **Referral Rewards**: Earn bonuses when referred users make purchases
- **Login Streak Rewards**: Daily login bonuses (₦2-50)
- **Welcome Bonus**: Random ₦2-50 bonus for new users
- **Hostel Rentals**: Connect tenants with agents, platform takes commission
- **Account Selling**: Safe marketplace for digital accounts with fraud prevention
- **Event Posting**: Promote concerts, parties, campus events
- **Trust System**: Verified seller badges, ratings, leaderboards
- **Admin Dashboard**: Manual verification, dispute resolution, user management

---

## 🔑 Environment Variables Setup

This app requires several environment variables to work properly. Below is a complete guide on what each one is and where to get it.

### **Required for Local Development (Replit)**

These are automatically set up by Replit when you use the built-in database and auth integrations:

```bash
DATABASE_URL=your_postgresql_connection_string
REPLIT_DB_URL=your_replit_db_url
```

**How to get them:**
- DATABASE_URL: Created automatically when you add PostgreSQL database in Replit
- These are already configured in your Replit environment

---

### **Required for Railway Deployment**

Add these to your Railway project's Environment Variables tab:

#### **1. SESSION_SECRET** (CRITICAL - Fixes deployment error)
**What it is**: A secret key used to encrypt user sessions  
**How to create it**: Generate a random string of 32+ characters

**Example**:
```bash
SESSION_SECRET=my_super_secret_random_key_12345abcdef67890xyz
```

**How to create a secure one**:
- Visit https://www.random.org/strings/
- Or run in terminal: `openssl rand -base64 32`
- Or just type random characters (minimum 32 characters)

**Where to add it in Railway**:
1. Go to your Railway project
2. Click on your deployment
3. Go to "Variables" tab
4. Click "New Variable"
5. Name: `SESSION_SECRET`
6. Value: Your random string
7. Save

---

#### **2. DATABASE_URL**
**What it is**: Connection string to your PostgreSQL database  
**How to get it**: Railway auto-creates this when you add PostgreSQL to your project

**To add PostgreSQL in Railway**:
1. Click "New" → "Database" → "PostgreSQL"
2. Railway will automatically set `DATABASE_URL` environment variable
3. Your app will connect automatically

---

### **Required for Payment Processing (Paystack)**

#### **3. PAYSTACK_SECRET_KEY**
**What it is**: Your Paystack secret API key (for backend)  
**Where to get it**:
1. Create free account at https://paystack.com
2. Go to Settings → API Keys & Webhooks
3. Copy your **Test Secret Key** (starts with `sk_test_`)
4. Later, copy **Live Secret Key** when ready for production

**Example**:
```bash
PAYSTACK_SECRET_KEY=sk_test_1234567890abcdefghijklmnopqrstuvwxyz
```

#### **4. PAYSTACK_PUBLIC_KEY**
**What it is**: Your Paystack public API key (for frontend)  
**Where to get it**:
1. Same place as secret key
2. Copy your **Test Public Key** (starts with `pk_test_`)

**Example**:
```bash
PAYSTACK_PUBLIC_KEY=pk_test_abcdefghijklmnopqrstuvwxyz1234567890
```

**Note**: For frontend access, Paystack public key must be prefixed with `VITE_`:
```bash
VITE_PAYSTACK_PUBLIC_KEY=pk_test_abcdefghijklmnopqrstuvwxyz1234567890
```

#### **5. PAYSTACK_WEBHOOK_SECRET**
**What it is**: Secret key to verify webhook authenticity  
**Where to get it**:
1. Paystack Dashboard → Settings → API Keys & Webhooks
2. Copy the webhook secret
3. Set up webhook URL: `https://your-domain.railway.app/api/webhooks/paystack`

---

### **Required for NIN Verification (Choose ONE)**

You need to pick either Korapay or Dojah for NIN verification.

#### **Option A: Korapay (Recommended)**

**6. KORAPAY_API_KEY**  
**What it is**: API key for NIN verification with selfie matching  
**Where to get it**:
1. Sign up at https://korapay.com
2. Go to Dashboard → API Keys
3. Copy your API key

**Cost**: ~₦20-30 per verification  

**Example**:
```bash
KORAPAY_API_KEY=your_korapay_api_key_here
```

#### **Option B: Dojah**

**6. DOJAH_API_KEY**  
**What it is**: Alternative to Korapay for NIN verification  
**Where to get it**:
1. Sign up at https://dojah.io
2. Get API credentials from dashboard

**Cost**: Similar pricing to Korapay

**Example**:
```bash
DOJAH_API_KEY=your_dojah_api_key_here
```

---

### **Optional Environment Variables**

These are optional but recommended for production:

#### **7. NODE_ENV**
```bash
NODE_ENV=production  # Railway should set this automatically
```

#### **8. PORT**
```bash
PORT=5000  # Railway sets this automatically
```

#### **9. FRONTEND_URL**
```bash
FRONTEND_URL=https://your-domain.railway.app
```

---

## 📝 Complete Environment Variables Checklist

### **For Railway Deployment:**
```bash
# CRITICAL - Must have these
SESSION_SECRET=your_random_32_char_string_here
DATABASE_URL=postgresql://user:pass@host:port/db  # Auto-set by Railway

# Payment (Paystack)
PAYSTACK_SECRET_KEY=sk_test_your_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_key_here
VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_key_here  # For frontend
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# NIN Verification (Choose one)
KORAPAY_API_KEY=your_korapay_key  # OR
DOJAH_API_KEY=your_dojah_key

# Optional
NODE_ENV=production
FRONTEND_URL=https://your-app.railway.app
```

### **For Local Development (Replit):**
Most are auto-configured, but you may need to add:
```bash
SESSION_SECRET=local_dev_secret_key_12345
PAYSTACK_SECRET_KEY=sk_test_your_test_key
VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_public_key
KORAPAY_API_KEY=your_test_key
```

---

## 🛠️ How to Set Environment Variables

### **In Replit:**
1. Click on "Secrets" (lock icon) in left sidebar
2. Add key-value pairs
3. These are automatically loaded as environment variables

### **In Railway:**
1. Open your project
2. Click on your deployment
3. Go to "Variables" tab
4. Click "New Variable" for each one
5. Add name and value
6. Click "Add"
7. Railway will auto-redeploy with new variables

---

## 💰 Cost Breakdown

### **Free Services:**
- **Hosting**: Railway (free tier: $5 credit/month, enough for testing)
- **Database**: Railway PostgreSQL (free tier included)
- **Paystack**: Free account, only pay 1.5% + ₦100 per transaction (capped at ₦2,000)

### **Paid Services:**
- **NIN Verification**: ₦20-30 per verification (only charged when someone verifies)
- **Scaling**: If you exceed Railway free tier, paid plans start at $5/month

---

## 🚀 Deployment Instructions

### **Deploy to Railway:**

1. **Connect GitHub**:
   - Push your code to GitHub
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - DATABASE_URL will be auto-set

3. **Add Environment Variables**:
   - Click on your web service
   - Go to "Variables" tab
   - Add all required variables from checklist above

4. **Set Build & Start Commands** (usually auto-detected):
   - Build: `npm run build`
   - Start: `npm run start`

5. **Generate Domain**:
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Your app will be live at: `your-app.railway.app`

6. **Configure Paystack Webhook**:
   - Copy your Railway URL
   - Go to Paystack Dashboard → Webhooks
   - Set webhook URL: `https://your-app.railway.app/api/webhooks/paystack`
   - Save

---

## 🧪 Testing Payment Integration

### **Use Paystack Test Cards:**
```
Success: 4084 0840 8408 4081
Decline: 4084 0000 0000 0408
```
- CVV: Any 3 digits
- Expiry: Any future date
- PIN (if asked): 1234

---

## 📱 Project Structure

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
│   └── replitAuth.ts   # Authentication
├── shared/             # Shared types & schemas
│   └── schema.ts       # Database schema & Zod schemas
└── uploads/            # User uploaded images
```

---

## 🔒 Security & Legal Compliance

### **NIN Data Protection (IMPORTANT)**
⚠️ **You CANNOT store raw 11-digit NIN numbers** (illegal under Nigerian law since Dec 2021)

**What you CAN do:**
- Store verification results (verified: true/false)
- Store confidence scores from selfie matching
- Store user consent records

**What you CANNOT do:**
- Store the actual NIN number
- Share NIN data with third parties
- Use NIN for purposes other than verification

### **NDPR Compliance**
Your app must comply with Nigeria Data Protection Regulation:
- Privacy Policy page (required)
- User consent for data collection
- Terms & Conditions
- Dispute resolution process

---

## 💡 Quick Start Guide

1. **Clone and Install**:
   ```bash
   git clone <your-repo>
   cd eksu-marketplace
   npm install
   ```

2. **Set Up Environment**:
   - Copy required environment variables
   - Add to `.env` file or Replit Secrets

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

## 🤝 Support

If you encounter issues:
1. Check that all environment variables are set correctly
2. Verify your Paystack account is in test mode
3. Make sure DATABASE_URL is accessible
4. Check Railway logs for deployment errors

---

## 📄 License

MIT License - Feel free to modify and use for your campus marketplace!

---

**Built for EKSU students, by students. Trade safely, study hard! 🎓**
