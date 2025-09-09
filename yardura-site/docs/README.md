# Yardura Documentation

Welcome to the Yardura project documentation. This comprehensive guide covers everything from development setup to production deployment.

## 📚 Documentation Structure

### 🏗️ **Architecture & Design**

- [System Overview](architecture/system-overview.md) - High-level system architecture
- [Database Schema](architecture/database-schema.md) - Prisma schema and relationships
- [API Design](architecture/api-design.md) - REST API structure and conventions
- [Security Model](security/security-model.md) - Authentication, authorization, and data protection

### 🚀 **Development**

- [Getting Started](development/getting-started.md) - Local development setup
- [Environment Setup](development/environment-setup.md) - Environment variables and secrets
- [Code Style](development/code-style.md) - Coding standards and best practices
- [Testing Guide](development/testing-guide.md) - Unit, integration, and E2E testing

### ⚙️ **Features & Components**

- [Quote Flow](features/quote-flow.md) - Multi-step quote process
- [Pricing Engine](features/pricing-engine.md) - Dynamic pricing calculations
- [Stripe Integration](features/stripe-integration.md) - Payment processing
- [Device Management](features/device-management.md) - IoT device integration
- [Admin Panel](features/admin-panel.md) - Administrative features

### 🔒 **Security**

- [Security Checklist](security/security-checklist.md) - Security best practices
- [API Security](security/api-security.md) - API authentication and rate limiting
- [Data Privacy](security/data-privacy.md) - GDPR and privacy compliance

### 🚢 **Deployment**

- [Production Deployment](deployment/production-deployment.md) - Production setup
- [CI/CD Pipeline](deployment/ci-cd-pipeline.md) - Build and deployment automation
- [Monitoring](deployment/monitoring.md) - Logging and error tracking

## 🎯 **Quick Start**

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/yardura.git
   cd yardura
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📋 **Project Status**

### ✅ **Completed Phases**

- Phase 0: Infrastructure Setup
- Google Places Autocomplete Integration
- Environment Validation & Secret Scanning
- Basic Documentation Structure

### 🔄 **In Progress**

- Phase 1: CTA Routing & Hash Fallback

### 📅 **Upcoming Phases**

- Phase 2: Authentication System (NextAuth)
- Phase 3: Quote Flow Enhancement
- Phase 4: Pricing System
- Phase 5: Stripe Metered Billing
- ... (see TODO list for full roadmap)

## 🔧 **Key Technologies**

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Payments**: Stripe (Metered Billing)
- **Authentication**: NextAuth.js
- **File Storage**: Supabase Storage
- **Deployment**: Vercel/Netlify
- **Hardware**: Raspberry Pi, Arduino, NFC Readers

## 🤝 **Contributing**

Please see our [Contributing Guide](development/contributing.md) for details on:

- Code of conduct
- Development workflow
- Pull request process
- Issue reporting

## 📞 **Support**

For questions or issues:

- Create an issue on GitHub
- Check the [FAQ](development/faq.md)
- Review the [Troubleshooting Guide](development/troubleshooting.md)

---

**Last updated**: December 2024
**Version**: 0.1.0

