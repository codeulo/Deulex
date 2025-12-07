# FireTrade MVP Architecture

## Overview

FireTrade is a crypto exchange and bill payment mobile application built with:

- **Frontend**: React Native / Next.js (Web)
- **Backend**: Next.js API Routes (Serverless)
- **Database**: Supabase (PostgreSQL)
- **Cache/Rate Limiting**: Upstash Redis
- **Auth**: Supabase Auth with custom 2FA

## System Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│ Client Applications │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ Mobile App │ │ Web App │ │ Admin │ │
│ │(React Native)│ │ (Next.js) │ │ Dashboard │ │
│ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼─────────────────┘
│ │ │
└────────────────┼────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ API Gateway Layer │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Next.js API Routes (/api/v1) │ │
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │ │
│ │ │ Auth │ │ Wallets │ │Exchange │ │ Bills │ │ │
│ │ └─────────┘ └─────────┘ └─────────┘ └────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
