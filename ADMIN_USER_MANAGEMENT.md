# Admin User Management API
# This would be used by admins to create accounts for new businesses

# POST /api/admin/users/create
# Body: { email, name, orgId, role: 'ADMIN' }
# Creates a new admin user for a business organization

# POST /api/admin/users/invite  
# Body: { email, name, orgId, role }
# Sends an invite email with a magic link for account setup

# For businesses signing contracts:
# 1. Admin creates the business org
# 2. Admin creates admin user account for the business
# 3. System sends welcome email with login credentials
# 4. Business admin can then invite their own team members

# This keeps business provisioning secure and controlled.
