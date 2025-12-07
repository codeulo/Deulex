# FireTrade Backend

Secure, high-performance backend for FireTrade - a Crypto Exchange and Bill Payment platform.

## Features

- 🔐 Multi-layered security with 2FA mandatory
- ⚡ Low-latency trade execution (P95 < 500ms)
- 💰 Dual-entry accounting system
- 🛡️ Row-level security (RLS) with PostgreSQL
- 🔄 Idempotency for financial operations
- 📊 Comprehensive audit logging
- 🚀 Serverless architecture with Next.js

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth + TOTP 2FA
- **Rate Limiting:** Upstash Redis
- **Validation:** Zod
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Upstash Redis account

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/firetrade-backend.git
cd firetrade-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start development server
npm run dev
```

### Environment Setup

See `.env.example` for required environment variables.

## Project Structure

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## API Documentation

OpenAPI 3.0 specification: [openapi/openapi.yaml](openapi/openapi.yaml)

## Security

See [SECURITY.md](docs/SECURITY.md) for security best practices and incident response procedures.

## Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage
```

## License

Proprietary - All Rights Reserved
