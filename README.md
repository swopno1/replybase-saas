# ReplyBase SaaS

**A Multi-Tenant SaaS Platform for Omni-channel Communication**

## 🚀 Overview

ReplyBase is a production-ready SaaS application that centralizes communication from Webchat, Telegram, and WhatsApp into a unified inbox for UK-based small businesses.

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe
- **AI Engine**: Modular AI Provider (Gemini, OpenAI, Anthropic)

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
│   │   ├── ai/           # AI provider endpoints
│   │   ├── billing/      # Stripe integration
│   │   └── ...
│   └── auth/             # Public auth pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Feature components
├── lib/                  # Shared libraries
│   ├── auth.ts          # NextAuth configuration
│   ├── ai-service.ts    # Modular AI service
│   ├── prisma.ts        # Database client
│   ├── stripe.ts        # Stripe integration
│   └── ...
├── prisma/               # Database
│   └── schema.prisma    # Database schema
├── scripts/              # Utility scripts
│   └── seed-stripe.ts   # Stripe plan seeding
└── public/              # Static assets
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.12+
- PostgreSQL database
- Stripe account
- Google OAuth credentials
- Facebook OAuth credentials

### Installation

```bash
# Clone repository
git clone <repository-url>
cd replybase-saas

# Install dependencies
pnpm install

# Generate environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma migrate deploy

# Seed Stripe plans
pnpm run seed:stripe

# Build for production
pnpm run build

# Start production server
pnpm start
```

### Development

```bash
# Run development server
pnpm dev

# Open http://localhost:3000
```

## 🔐 Security Model

### Authentication Flow

1. **User Authentication**: NextAuth (Google, Facebook, Email/Password)
2. **Session Management**: JWT-based sessions
3. **Subscription Validation**: Middleware checks on every request

### Access Control

- **SaaS App**: Public access for registration, protected for features

### Key Security Features

- Subscription-based access control
- Rate limiting per plan
- JWT token validation
- Secure session management

## 🚨 Troubleshooting

### Common Issues

**Issue**: Subscription check fails

- **Solution**: Run `pnpm run seed:stripe`
- **Solution**: Verify subscription exists in database

**See**: [QUICK_START_DEPLOYMENT.md - Common Issues](./QUICK_START_DEPLOYMENT.md#-common-issues)

## 📄 License

[Add your license here]

## 🙏 Acknowledgments

- Next.js team for the framework
- Prisma for database ORM
- Stripe for payment processing
