# Aegis Support: Multi-Agent Banking Insights & Fraud Triage

## System Overview

Aegis Support is an internal tool for banking care agents to analyze transactions, generate AI reports, and triage suspected fraud using a multi-agent pipeline. The system provides real-time fraud detection, risk scoring, and automated triage workflows with human oversight.

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: React Query for server state, Zustand for client state
- **UI Components**: Material-UI (MUI) for accessibility and performance
- **Virtualization**: react-window for large transaction lists
- **Real-time**: Server-Sent Events (SSE) for agent progress updates

### Backend (Express.js + TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with partitioning by month
- **Cache**: Redis for rate limiting and session management
- **Authentication**: API key-based with RBAC (agent/lead roles)
- **Observability**: Winston for logging, Prometheus metrics
- **Multi-Agent**: Custom orchestrator with tool-using agents

### Database Design
- **Partitioning**: Transactions table partitioned by month
- **Indexes**: 
  - `(customerId, ts DESC)` for customer transaction queries
  - `(merchant)` for merchant-based filtering
  - `(mcc)` for category analysis
- **Storage**: 1M+ transactions with optimized queries (p95 ≤ 100ms)

### Multi-Agent System
- **Orchestrator**: Plans and coordinates agent workflow
- **Agents**: Insights, Fraud Detection, KB Search, Compliance, Redaction, Summarization
- **Guardrails**: Retries, timeouts, circuit breakers, schema validation
- **Fallbacks**: Deterministic rule-based fallbacks when AI unavailable

## Key Features

### Care Agent Workflow
1. Upload/fetch customer transactions
2. View AI-generated spend insights
3. Triage suspicious activity with multi-agent workflow
4. Take actions (freeze card, open dispute, contact customer)

### Team Lead Dashboard
- Risk queue management
- SLA monitoring
- Agent effectiveness metrics
- Model evaluation results

### Security & Compliance
- PII redaction (PAN numbers, emails)
- API key authentication
- Rate limiting (5 req/s per session)
- Idempotency for all mutating operations
- Content Security Policy (CSP)

## Performance Requirements
- Transaction queries: p95 ≤ 100ms (90-day window)
- Agent triage: ≤ 5s end-to-end
- Support 1M+ transactions
- Virtualized UI for 2k+ rows
- Real-time streaming updates

## Technology Choices

### Frontend: React + TypeScript
- **Why**: Mature ecosystem, excellent TypeScript support, strong community
- **Trade-offs**: Larger bundle size vs Vue, but better tooling and ecosystem

### Backend: Express.js + TypeScript
- **Why**: Lightweight, fast, excellent middleware ecosystem
- **Trade-offs**: Less opinionated than NestJS, but more flexible and faster to develop

### Database: PostgreSQL
- **Why**: ACID compliance, excellent partitioning support, mature ecosystem
- **Trade-offs**: More complex than SQLite, but production-ready and scalable

### Caching: Redis
- **Why**: Fast in-memory storage, excellent for rate limiting and sessions
- **Trade-offs**: Additional infrastructure, but essential for performance

## Deployment
- **Local Development**: Docker Compose (PostgreSQL + Redis + Backend + Frontend)
- **Production**: Containerized services with proper monitoring
- **Offline Support**: Deterministic fallbacks, no external API dependencies
