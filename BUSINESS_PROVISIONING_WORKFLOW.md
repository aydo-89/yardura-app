# Business Provisioning Workflow

## Overview
When a new business signs a contract with Yardura, we need to provision them with their own admin account and organization setup. This is handled through the God Mode panel.

## Workflow Steps

### 1. Business Signs Contract
- Business provides contact information (name, email)
- Choose an organization ID (e.g., "smithlandscaping", "greenvalleylandscape")

### 2. Create Business Admin Account (God Mode)
- Access God Mode panel (`/admin/god-mode`)
- Click "Invite Business Admin"
- Fill out the form:
  - **Email**: Business contact's email
  - **Name**: Business contact's full name
  - **Organization ID**: Unique identifier for the business (lowercase, no spaces)
  - **Role**: Admin (Business Owner)

### 3. System Actions
- Creates user account in database
- Assigns user to their organization
- Generates temporary password
- Sends welcome email with:
  - Account credentials
  - Magic link login URL
  - Setup instructions
  - Next steps guidance

### 4. Business Admin Setup
- Receives email with login link
- Signs in with magic link
- Completes profile setup
- Accesses admin dashboard
- Configures business settings:
  - Pricing configuration
  - Service areas (ZIP codes)
  - Business information

### 5. Business Operations
- Business admin can now:
  - Invite team members
  - Manage leads
  - Configure pricing
  - View analytics
  - Manage service areas

## Email Template

Subject: Welcome to Yardura Service OS - Account Setup

```
Hello [Name],

Your Yardura Service OS account has been created! As an admin user, you now have access to:

• Business configuration and pricing management
• Lead management and customer tracking
• Service area management
• Analytics and reporting

To get started:
1. Click the link below to sign in
2. You'll receive a magic link via email
3. Complete your profile setup
4. Configure your business settings

[Sign In Button]

Temporary Credentials:
Email: [email]
Temporary Password: [temp_password]

⚠️ Important: Change your password after first login for security.

Best regards,
The Yardura Team
```

## Organization ID Guidelines

- Use lowercase letters and numbers only
- No spaces or special characters
- Should be unique and memorable
- Examples:
  - `smithlandscaping`
  - `greenvalleylandscape`
  - `precisionlawncare`
  - `evergreengardens`

## Security Considerations

- Only `ayden@yardura.com` can access God Mode
- Business admins cannot access other businesses' data
- Each organization is isolated in multi-tenant architecture
- All actions are logged and auditable

## Troubleshooting

### Business Can't Access Admin Panel
- Verify organization ID is correct
- Check if user role is set to ADMIN
- Ensure user account was created successfully

### Email Not Received
- Check spam/junk folder
- Verify email address is correct
- Resend invitation from God Mode panel

### Organization Setup Issues
- Organization ID must be unique
- Business admin must complete initial setup
- Pricing configuration required before accepting leads

