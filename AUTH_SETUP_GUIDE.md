# Authentication Setup Guide

This guide will help you set up authentication for the Yardura application, including Google OAuth, email magic links, and password-based authentication for sales reps.

## 1. Environment Variables Setup

Update your `.env.local` file with the following:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here-generate-a-new-one

# Google OAuth (replace with your actual credentials)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration (for magic links)
EMAIL_FROM=noreply@yardura.com
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password

# Admin Configuration
ADMIN_EMAILS=your-admin-email@gmail.com,another-admin@yardura.com

# Database
DATABASE_URL="file:./dev.db"

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
```

## 2. Google OAuth Setup

### Step 1: Create Google Cloud Console Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API

### Step 2: Configure OAuth Consent Screen
1. Go to "OAuth consent screen"
2. Configure the required fields:
   - User Type: External
   - App name: Yardura
   - User support email: your-email@gmail.com
   - Developer contact information: your-email@gmail.com

### Step 3: Create OAuth Credentials
1. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
2. Application type: Web application
3. Name: Yardura Development
4. Authorized JavaScript origins:
   - `http://localhost:3000`
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`

### Step 4: Get Your Credentials
- Copy the Client ID and Client Secret
- Add them to your `.env.local` file

## 3. Email Magic Link Setup

### Option A: Gmail SMTP Relay (Production)
1. Go to Google Workspace Admin Console
2. Navigate to "Apps" → "Google Workspace" → "Gmail"
3. Enable SMTP relay service
4. Create an app password for your account
5. Use these credentials in your `.env.local`

### Option B: Mailtrap (Development)
1. Sign up for [Mailtrap](https://mailtrap.io/)
2. Create a new inbox
3. Get SMTP credentials from the "SMTP Settings" tab
4. Update your `.env.local` with Mailtrap credentials

## 4. Database Migration

Run the Prisma migration to add sales rep functionality:

```bash
cd /Users/aydendunham/yardura_site/yardura-site
npx prisma generate
npx prisma db push
```

## 5. Test Authentication

### Start the development server:
```bash
npm run dev
```

### Test the authentication flows:

1. **Google OAuth**: Go to `/signin` and click "Continue with Google"
2. **Email Magic Link**: Enter your email and click "Continue with Email"
3. **Password Authentication**: Create a sales rep account first, then sign in with email/password

## 6. Creating Sales Rep Accounts

### As an Admin:
1. Sign in with an admin email (listed in ADMIN_EMAILS)
2. Go to `/admin/sales-reps/create`
3. Fill out the form to create a sales rep account

### Sales Rep Features:
- Create customer accounts with referral tracking
- View commission dashboard at `/sales-rep/dashboard`
- Track earnings from customer referrals

## 7. Troubleshooting

### Common Issues:

1. **Google OAuth not working**:
   - Check that `NEXTAUTH_URL` is set to `http://localhost:3000`
   - Verify Google OAuth credentials are correct
   - Ensure authorized origins and redirect URIs match exactly

2. **Email magic links not working**:
   - For Gmail SMTP: Use an app password, not your regular password
   - For Mailtrap: Ensure you're using the correct SMTP settings
   - Check that `EMAIL_SERVER_HOST` and other email settings are correct

3. **Database connection issues**:
   - Ensure Prisma client is generated: `npx prisma generate`
   - Check that database file exists and is writable

4. **Access denied errors**:
   - Verify user roles in the database
   - Check that ADMIN_EMAILS environment variable is set correctly
   - Restart the development server after environment changes

### Debug Commands:

```bash
# Check database contents
npx prisma studio

# View NextAuth logs
DEBUG=next-auth:* npm run dev

# Test email configuration
curl -X POST http://localhost:3000/api/auth/signin/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## 8. Production Deployment

When deploying to production:

1. Update `NEXTAUTH_URL` to your production domain
2. Use production database (not SQLite file)
3. Set up proper SMTP service (Gmail SMTP Relay recommended)
4. Update Google OAuth credentials with production domain
5. Ensure all environment variables are set in your deployment platform

## 9. Security Notes

- **Never commit `.env.local` to version control**
- **Use strong passwords for admin accounts**
- **Regularly rotate API keys and secrets**
- **Enable 2FA on Google accounts used for OAuth**
- **Monitor authentication logs for suspicious activity**

## 10. Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the terminal for NextAuth debug logs
3. Verify all environment variables are set correctly
4. Test with different browsers to rule out browser-specific issues
5. Check that the database is properly migrated and accessible

For additional help, check the NextAuth.js documentation or create an issue in the project repository.
