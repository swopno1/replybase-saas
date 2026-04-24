# ReplyBase SaaS

**A Multi-Tenant SaaS Platform with Secure Typebot Integration**

## 🚀 Overview

ReplyBase is a production-ready SaaS application that provides secure access to Typebot builder/viewer through OIDC-based authentication and subscription management.

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js + OIDC Provider
- **Payments**: Stripe
- **Deployment**: Docker + Coolify + Digital Ocean
- **Bot Engine**: Typebot (external integration)

## 📚 Documentation

### 🎯 Start Here

- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Executive summary and next steps
- **[QUICK_START_DEPLOYMENT.md](./QUICK_START_DEPLOYMENT.md)** - Fast deployment guide

### 📋 Production Deployment

1. **[PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md)**
   - Current state analysis
   - Issues and gaps
   - Risk assessment
   - Readiness checklist

2. **[PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md)**
   - Complete 6-phase deployment plan
   - Step-by-step instructions
   - Testing procedures
   - Rollback strategy

### 🔧 Technical Guides

- **[TYPEBOT_ENGINE_CONFIGURATION.md](./TYPEBOT_ENGINE_CONFIGURATION.md)** - Typebot OIDC setup
- **[INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md)** - Nginx/reverse proxy config
- **[PHASE1_IMPLEMENTATION_GUIDE.md](./PHASE1_IMPLEMENTATION_GUIDE.md)** - Detailed implementation
- **[PHASE1_SUMMARY.md](./PHASE1_SUMMARY.md)** - Phase 1 overview

## 🏗️ Project Structure

```
replybase-saas/
├── app/                    # Next.js app directory
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── bots/         # Bot management
│   │   ├── conversations/ # Conversation management
│   │   ├── settings/     # User settings
│   │   └── ...
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── oidc/         # OIDC provider endpoints
│   │   ├── typebot/      # Typebot integration
│   │   ├── billing/      # Stripe integration
│   │   └── ...
│   └── auth/             # Public auth pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Feature components
├── lib/                  # Shared libraries
│   ├── auth.ts          # NextAuth configuration
│   ├── oidc-provider.ts # OIDC provider setup
│   ├── oidc-adapter.ts  # Prisma adapter for OIDC
│   ├── prisma.ts        # Database client
│   ├── stripe.ts        # Stripe integration
│   └── ...
├── prisma/               # Database
│   └── schema.prisma    # Database schema
├── scripts/              # Utility scripts
│   ├── generate-jwks.js # OIDC key generation
│   └── seed-stripe.ts   # Stripe plan seeding
└── public/              # Static assets
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.12+
- PostgreSQL database
- Digital Ocean account (or similar)
- Coolify installed
- Stripe account
- Google OAuth credentials
- Facebook OAuth credentials

### Installation

```bash
# Clone repository
git clone <repository-url>
cd replybase-saas

# Install dependencies
npm install

# Generate environment template
cp .env.example .env

# Generate OIDC keys
node scripts/generate-jwks.js

# Edit .env with your configuration
nano .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed Stripe plans
npm run seed:stripe

# Build for production
npm run build

# Start production server
npm start
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

## 🔐 Security Model

### Authentication Flow

1. **User Authentication**: NextAuth (Google, Facebook, Email/Password)
2. **Session Management**: JWT-based sessions
3. **Subscription Validation**: Middleware checks on every request
4. **OIDC Provider**: Issues tokens for Typebot access
5. **Token Validation**: Typebot validates tokens from SaaS app

### Access Control

- **SaaS App**: Public access for registration, protected for features
- **Typebot Engine**: ONLY accessible via OIDC flow (no direct access)
- **Typebot Viewer**: Public bot viewing, admin routes blocked

### Key Security Features

- OIDC-based authentication for Typebot
- Subscription-based access control
- Rate limiting per plan
- Infrastructure-level access restrictions
- JWT token validation
- Secure session management

## 📊 Deployment Status

**Current Status**: 🟡 **Configuration Needed**

- ✅ Code: 90% Complete
- ⚠️ Configuration: 20% Complete
- ❌ Infrastructure: 10% Complete
- ✅ Documentation: 85% Complete
- ❌ Testing: 0% Complete

**Overall Readiness**: 40%

### Critical Blockers

1. ❌ OIDC keys not generated
2. ❌ Environment variables not set
3. ❌ Typebot Engine not configured
4. ❌ Infrastructure security not applied
5. ❌ Database not seeded
6. ❌ End-to-end testing not done

**See**: [PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md) for details

## 🛠️ Environment Variables

**Required Variables**: 37

Key categories:

- Authentication (AUTH_SECRET, OAuth providers)
- OIDC (OIDC_JWKS, OIDC_COOKIE_KEY, client secrets)
- Database (DATABASE_URL)
- Stripe (API keys, price IDs)
- Application (URLs, Node environment)

**See**: [.env.example](./.env.example) for complete template

## 📈 Subscription Plans

| Plan     | Price/mo | Bots | Messages/day | Features            |
| -------- | -------- | ---- | ------------ | ------------------- |
| Starter  | $9.99    | 1    | 100          | Basic features      |
| Pro      | $29.99   | 5    | 500          | Advanced features   |
| Business | $99.99   | 20   | 2000         | Enterprise features |

Plans are configured in Stripe and seeded via `scripts/seed-stripe.ts`

## 🧪 Testing

**Status**: ❌ Not implemented

**Required Tests**:

- [ ] User registration flow
- [ ] Subscription checkout
- [ ] OIDC authentication
- [ ] Bot builder access
- [ ] Security restrictions
- [ ] API endpoints
- [ ] Webhook handling

**See**: [PRODUCTION_DEPLOYMENT_PLAN.md - Phase 5](./PRODUCTION_DEPLOYMENT_PLAN.md#phase-5-testing--validation)

## 🚨 Troubleshooting

### Common Issues

**Issue**: OIDC flow fails

- **Solution**: Check `OIDC_JWKS` is valid JSON
- **Solution**: Verify `TYPEBOT_OIDC_CLIENT_SECRET` matches in both apps

**Issue**: Can't access Typebot

- **Solution**: Verify OIDC configuration on Typebot Engine
- **Solution**: Check Nginx rules aren't blocking callback endpoint

**Issue**: Subscription check fails

- **Solution**: Run `npm run seed:stripe`
- **Solution**: Verify subscription exists in database

**See**: [QUICK_START_DEPLOYMENT.md - Common Issues](./QUICK_START_DEPLOYMENT.md#-common-issues)

## 📞 Support

### Documentation

- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Overview
- [PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md) - Detailed deployment
- [PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md) - Current state analysis

### Key Commands

```bash
# Check health
curl https://app.replybase.co.uk/api/health

# View logs
docker logs -f replybase-saas

# Database access
psql $DATABASE_URL

# Generate keys
node scripts/generate-jwks.js
```

## 🤝 Contributing

1. Review [PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md)
2. Follow [PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md)
3. Test changes thoroughly
4. Update documentation

## 📄 License

[Add your license here]

## 🙏 Acknowledgments

- Next.js team for the framework
- Typebot for the bot engine
- Prisma for database ORM
- Stripe for payment processing

---

**Ready to Deploy?** Start with [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
