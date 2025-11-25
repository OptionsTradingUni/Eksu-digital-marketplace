# Railway Deployment Guide - EKSU Campus Marketplace

This guide helps you deploy the EKSU Campus Marketplace to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **Required API Keys**:
   - Groq API Key (free) - Get from [console.groq.com](https://console.groq.com)
   - Replit OAuth credentials (if using Replit Auth)

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your EKSU marketplace repository
4. Railway will auto-detect it's a Node.js app

### 2. Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance
4. **IMPORTANT**: Railway creates TWO database URLs:
   - `DATABASE_URL` - Internal URL (only works between Railway services)
   - `DATABASE_PUBLIC_URL` - **Public URL (USE THIS ONE)**
5. Go to your Postgres service → Variables tab
6. **Copy the `DATABASE_PUBLIC_URL`** value (contains `proxy.rlwy.net`)

### 3. Configure Environment Variables

Click on your web service → "Variables" and add:

```bash
# Database - CRITICAL: Use PUBLIC URL from Postgres service
# Go to Postgres service → Variables → Copy DATABASE_PUBLIC_URL
# Should contain "proxy.rlwy.net" NOT "railway.internal"
DATABASE_URL=postgresql://postgres:PASSWORD@roundhouse.proxy.rlwy.net:PORT/railway

# Session Secret (use the one generated below)
SESSION_SECRET=eb5b5ffee77c780593d5781bcfd6c8b08bb2b90523f47299da007cb54a9e2cad

# Groq AI Chatbot (required)
GROQ_API_KEY=your_groq_api_key_here

# Node Environment
NODE_ENV=production

# Replit Auth (optional - only if using Replit Auth, otherwise skip)
REPL_ID=your_replit_id
ISSUER_URL=https://replit.com/oidc
```

#### How to Get Groq API Key (FREE):
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google/GitHub
3. Click "API Keys" in sidebar
4. Click "Create API Key"
5. Copy the key and paste it in Railway

#### Generate Session Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure Build & Start Commands

Railway should auto-detect these, but verify:

**Build Command**:
```bash
npm install && npm run db:push
```

**Start Command**:
```bash
npm run dev
```

### 5. Set Up Custom Domain (Optional)

1. Click on your service → "Settings" → "Domains"
2. Click "Generate Domain" for a free `.railway.app` domain
3. Or add your custom domain (e.g., `marketplace.eksu.edu.ng`)

### 6. Deploy

1. Click "Deploy" - Railway will build and start your app
2. Monitor the build logs for any errors
3. Once deployed, click the URL to view your marketplace

## Database Migrations

The app uses Drizzle ORM with automatic migrations:

- **Initial Setup**: `npm run db:push` runs during build
- **Schema Changes**: Push to GitHub → Railway auto-redeploys → migrations run automatically

### Manual Migration (if needed):
```bash
# Connect to Railway via CLI
railway login
railway link

# Run migrations
railway run npm run db:push --force
```

## Environment-Specific Notes

### Production vs Development

- **Development** (Replit): Uses `NODE_ENV=development`, hot reload enabled
- **Production** (Railway): Uses `NODE_ENV=production`, optimized builds

The app automatically adapts based on `NODE_ENV`.

### WebSocket Support

Real-time chat uses WebSockets. Railway supports WebSockets by default - no extra configuration needed!

## Monitoring & Logs

### View Logs:
1. Click on your service in Railway
2. Click "Deployments" → Click latest deployment
3. View real-time logs

### Common Issues:

**Build Fails**:
- Check environment variables are set
- Verify `GROQ_API_KEY` is present
- Check build logs for specific errors

**Database Connection Error**:
- Verify PostgreSQL service is running
- Check `DATABASE_URL` is set correctly
- Ensure database and web service are in same project

**Chatbot Not Working**:
- Verify `GROQ_API_KEY` is set
- Check Groq API quota (free tier limits)
- Review logs for API errors

## Scaling

Railway auto-scales based on your plan:

- **Starter Plan**: 500 hours/month free
- **Developer Plan**: $5/month - higher limits
- **Team Plan**: $20/month - production-ready

## Backups

Railway provides automatic daily backups for PostgreSQL:
1. Click on PostgreSQL service
2. Go to "Backups"
3. Download or restore as needed

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: Join for help
- **Project Issues**: Create GitHub issue

## Cost Estimates

**Free Tier** (Starter):
- 500 execution hours/month
- PostgreSQL included
- Good for testing

**Paid** (Developer $5/mo):
- Unlimited hours
- Better performance
- Custom domains
- Production-ready

**AI Costs**:
- Groq API: **100% FREE** (rate limited)
- No AI costs for this marketplace!

## Next Steps

After deployment:

1. ✅ Test user registration and login
2. ✅ Create test listings
3. ✅ Test chatbot functionality
4. ✅ Verify escrow payments work
5. ✅ Test real-time chat
6. ✅ Configure custom domain
7. ✅ Set up monitoring alerts

Your EKSU Campus Marketplace is now live! 🎉
