# Admin Panel Documentation

This document provides comprehensive instructions for accessing and using the EKSU Campus Marketplace Admin Panel.

## Table of Contents

1. [Accessing the Admin Panel](#accessing-the-admin-panel)
2. [Creating an Admin Account](#creating-an-admin-account)
3. [Admin Panel Features Overview](#admin-panel-features-overview)
4. [User Management](#user-management)
5. [Product Management](#product-management)
6. [Announcements Management](#announcements-management)
7. [Database Metrics & Analytics](#database-metrics--analytics)
8. [Disputes and Reports](#disputes-and-reports)
9. [Support Access](#support-access)
10. [API Reference](#api-reference)

---

## Accessing the Admin Panel

### URL
Navigate to `/admin` on your application domain:
- Local development: `http://localhost:5000/admin`
- Production: `https://your-domain.com/admin`

### Authentication Requirements
To access the admin panel, you must be logged in as a user with admin privileges. The system checks for admin access in two ways:

1. **Environment Variable (Recommended)**: Your user ID is listed in the `SUPER_ADMIN_IDS` environment variable
2. **Database Role**: Your user account has `role: "admin"` in the database

If you don't have admin access, you'll be redirected to the home page with an "Access Denied" message.

---

## Creating an Admin Account

There are two methods to grant admin access:

### Method 1: Environment Variable (Recommended for Super Admins)

Add user IDs to the `SUPER_ADMIN_IDS` environment variable. Multiple IDs can be comma-separated:

```bash
SUPER_ADMIN_IDS=user-uuid-1,user-uuid-2,user-uuid-3
```

**How to find a user's ID:**
1. The user must first create a regular account via the registration form
2. Query the database to find their ID:
```sql
SELECT id, email, first_name, last_name FROM users WHERE email = 'admin@example.com';
```
3. Copy the `id` value and add it to `SUPER_ADMIN_IDS`

### Method 2: Database Role Update

Update the user's role directly in the database:

```sql
UPDATE users 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'admin@example.com';
```

**Note:** Users cannot set their own role to "admin" through the API - this is blocked for security.

### Default Credentials
There are no default admin credentials. Admin accounts must be created explicitly using one of the methods above.

---

## Admin Panel Features Overview

The Admin Panel contains four main tabs:

| Tab | Description |
|-----|-------------|
| **Users** | View and manage all registered users |
| **Products** | Moderate product listings |
| **Campus Updates** | Create and manage announcements |
| **Database Metrics** | View database analytics and performance stats |

### Dashboard Statistics

At the top of the admin panel, you'll see summary cards showing:
- **Total Users**: Count of all registered users and verified users
- **Total Products**: Count of active product listings
- **Flagged Items**: Products that need review
- **Revenue**: Monthly revenue (currently tracking only)

---

## User Management

### Viewing Users

The Users tab displays a table with the following information:
- User name and email
- Role (buyer, seller, both, admin)
- Verification status
- Trust score and total ratings

### Verify a User

Verifying a user marks them as a trusted member of the marketplace.

**Steps:**
1. Go to the **Users** tab
2. Find the user you want to verify
3. Click the **Verify** button in the Actions column

**What happens:**
- User's `isVerified` flag is set to `true`
- A green "Verified" badge appears on their profile
- Users can see the verified badge next to their name

### Ban a User

Banning prevents a user from accessing the marketplace.

**Steps:**
1. Go to the **Users** tab
2. Find the user you want to ban
3. Click the **Ban** button (red, in Actions column)
4. The user is immediately banned

**What happens:**
- User's `isBanned` flag is set to `true`
- User's `isActive` flag is set to `false`
- A ban reason is recorded (default: "Violation of terms")
- The user cannot log in or use the marketplace

**Note:** You cannot ban yourself (the Ban button is hidden for your own account).

### Unban a User

Currently, unbanning must be done directly via the database:

```sql
UPDATE users 
SET is_banned = false, is_active = true, ban_reason = NULL, updated_at = NOW() 
WHERE id = 'user-uuid-here';
```

---

## Product Management

### Viewing Products

The Products tab displays all marketplace listings with:
- Product image and title
- Price
- Status (Approved, Pending, or Flagged)
- View count

### Approve a Product

Products may require manual approval before becoming visible.

**Steps:**
1. Go to the **Products** tab
2. Look for products with a "Pending" badge
3. Click the **Approve** button

**What happens:**
- Product's `isApproved` flag is set to `true`
- The product becomes visible in marketplace searches

### Flag a Product

Flagging marks a product for review due to policy violations.

**Via API (no UI button currently):**
```bash
PUT /api/admin/products/:productId/flag
Content-Type: application/json

{
  "reason": "Prohibited item - weapons"
}
```

**What happens:**
- Product's `isFlagged` flag is set to `true`
- The flag reason is stored
- Product may be hidden from searches

### Remove a Product

To remove a product, use the database directly:

```sql
DELETE FROM products WHERE id = 'product-uuid-here';
```

Or mark it as unavailable:

```sql
UPDATE products 
SET is_available = false, is_sold = true, updated_at = NOW() 
WHERE id = 'product-uuid-here';
```

---

## Announcements Management

Announcements (Campus Updates) allow admins to communicate with all users.

### Creating an Announcement

1. Go to the **Campus Updates** tab
2. Click **New Announcement**
3. Fill in the form:
   - **Title**: Headline for the announcement
   - **Content**: Full message text
   - **Category**: Update, New Feature, or Alert
   - **Priority**: Low, Normal, or High
   - **Pinned**: Toggle to pin to the top of the feed
   - **Published**: Toggle to make visible to users
4. Click **Create** or **Save**

### Editing an Announcement

1. Find the announcement in the list
2. Click the **Edit** (pencil) icon
3. Update the fields as needed
4. Click **Save**

### Deleting an Announcement

1. Find the announcement in the list
2. Click the **Delete** (trash) icon
3. Confirm the deletion

### Announcement Categories

| Category | Icon | Use Case |
|----------|------|----------|
| Update | Megaphone | General updates and news |
| Feature | Sparkles | New feature announcements |
| Alert | Warning | Important alerts and warnings |

### Priority Levels

- **Low**: Normal styling
- **Normal**: Default priority
- **High**: Highlighted/emphasized

---

## Database Metrics & Analytics

The Database Metrics tab provides real-time insights into your application's database.

### Summary Cards

- **Total Database Size**: Combined size of all tables
- **Active Connections**: Current database connections
- **Query Stats**: Number of tracked query types

### Table Storage Chart

A bar chart showing the top 10 largest tables by size (in MB).

### Connection States

A pie chart breaking down database connections by state:
- Active
- Idle
- Idle in transaction
- Other states

### Performance Statistics

- **Deadlocks**: Number of deadlocks detected
- **Temp Files**: Temporary files created
- **Temp Data**: Size of temporary data used

### Table Details

A detailed table showing:
- Table name
- Row count (estimate)
- Table size
- Index size
- Total size

**Note:** Metrics refresh automatically every 30 seconds.

---

## Disputes and Reports

### User Reports

Users can report other users or products for violations. Reports are stored with:
- Reporter ID
- Reported user/product ID
- Reason
- Description
- Status (pending, reviewed, resolved)

**Viewing Reports (Database):**
```sql
SELECT r.*, 
       reporter.email as reporter_email,
       reported_user.email as reported_user_email,
       p.title as product_title
FROM reports r
LEFT JOIN users reporter ON r.reporter_id = reporter.id
LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
LEFT JOIN products p ON r.reported_product_id = p.id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC;
```

**Updating Report Status:**
```sql
UPDATE reports 
SET status = 'resolved', updated_at = NOW() 
WHERE id = 'report-uuid-here';
```

### Transaction Disputes

Users can open disputes for problematic transactions. Disputes include:
- Order/transaction reference
- Buyer ID
- Reason and description
- Evidence (optional)
- Status

**Viewing Disputes (Database):**
```sql
SELECT * FROM disputes 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

---

## Support Access

In addition to admin access, the system supports a separate **Support Representative** role.

### Configuring Support Representatives

Add user IDs to the `SUPPORT_IDS` environment variable:

```bash
SUPPORT_IDS=support-user-id-1,support-user-id-2
```

### Support Permissions

- Support reps have access to customer support features
- They can view support tickets and respond to users
- Super admins have full support access plus admin access

---

## API Reference

### User Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| PUT | `/api/admin/users/:id/verify` | Verify a user |
| PUT | `/api/admin/users/:id/ban` | Ban a user |

### Product Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/products` | Get all products |
| PUT | `/api/admin/products/:id/approve` | Approve a product |

### Announcement APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/announcements` | Get all announcements (including unpublished) |
| POST | `/api/announcements` | Create a new announcement |
| PATCH | `/api/announcements/:id` | Update an announcement |
| DELETE | `/api/announcements/:id` | Delete an announcement |

### Database Metrics APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/metrics/tables` | Get table storage metrics |
| GET | `/api/admin/metrics/activity` | Get connection activity |
| GET | `/api/admin/metrics/performance` | Get performance statistics |

### Authentication

All admin API endpoints require:
1. Valid user session (authenticated)
2. Admin role (via `SUPER_ADMIN_IDS` env var or database role)

Unauthorized requests return:
```json
{ "message": "Unauthorized" }  // 401 - Not logged in
{ "message": "Forbidden" }     // 403 - Not an admin
```

---

## Security Best Practices

1. **Limit Admin Access**: Only grant admin access to trusted individuals
2. **Use Environment Variables**: Prefer `SUPER_ADMIN_IDS` over database roles for easier management
3. **Audit Actions**: Monitor admin actions through database logs
4. **Regular Review**: Periodically review admin access and remove unnecessary privileges
5. **Strong Passwords**: Ensure all admin accounts use strong, unique passwords

---

## Troubleshooting

### "Access Denied" when accessing /admin

**Cause:** Your user account doesn't have admin privileges.

**Solution:**
1. Check if your user ID is in `SUPER_ADMIN_IDS`
2. Check if your database role is set to "admin"
3. Ensure you're logged in

### Admin actions not persisting

**Cause:** Database connection issues or transaction failures.

**Solution:**
1. Check database connectivity
2. Review server logs for errors
3. Verify database permissions

### Metrics not loading

**Cause:** Database statistics functions may not be available.

**Solution:**
1. Ensure PostgreSQL has `pg_stat_statements` extension enabled
2. Check database user has permission to access system catalogs
