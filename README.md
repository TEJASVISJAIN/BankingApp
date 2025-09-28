# Aegis Banking Fraud Detection System

A comprehensive fraud detection and triage system built with NestJS, React, and PostgreSQL, featuring multi-agent AI orchestration for real-time fraud analysis.

## 🚀 Quick Start (≤3 Commands)

```bash
# 1. Start the entire system
docker-compose up -d

# 2. Populate with test data
npm run seed

# 3. Run evaluations
npm run eval
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  NestJS Backend  │    │   PostgreSQL    │
│   (Port 3000)   │◄──►│   (Port 3001)   │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis        │
                       │   (Port 6379)    │
                       └─────────────────┘
```

### Core Components

**Frontend (React/TypeScript)**
- Dashboard with KPIs and fraud alerts
- Customer transaction timeline
- Triage drawer with real-time agent updates
- Virtualized tables for large datasets

**Backend (NestJS/TypeScript)**
- Multi-agent orchestration system
- RESTful APIs with SSE streaming
- Database partitioning and indexing
- Comprehensive observability

**Multi-Agent System**
- **Orchestrator**: Plans and coordinates agent execution
- **Fraud Agent**: Risk scoring and pattern detection
- **Insights Agent**: Transaction analysis and categorization
- **KB Agent**: Knowledge base search and citation
- **Compliance Agent**: Policy enforcement and blocking
- **Redactor**: PII detection and sanitization

## 🔧 Key Trade-offs

### Performance vs. Accuracy
- **Chosen**: Rule-based fallbacks for 99.9% uptime
- **Trade-off**: Slightly lower accuracy during LLM outages
- **Rationale**: Banking systems require guaranteed response times

### Real-time vs. Batch Processing
- **Chosen**: Real-time triage with 5s timeout
- **Trade-off**: Higher infrastructure costs
- **Rationale**: Fraud detection requires immediate response

### Data Privacy vs. Analytics
- **Chosen**: PII redaction with selective analytics
- **Trade-off**: Limited historical analysis capabilities
- **Rationale**: Compliance with banking regulations

### Scalability vs. Complexity
- **Chosen**: Database partitioning with application-level sharding
- **Trade-off**: More complex query logic
- **Rationale**: Supports 1M+ transactions with sub-100ms queries

## 📊 Performance Targets

- **Query Performance**: Customer transactions (90 days) p95 ≤ 100ms
- **Agent E2E**: Triage decision ≤ 5s on fixtures
- **Rate Limiting**: 5 req/s per session with exponential backoff
- **Availability**: 99.9% uptime with circuit breakers

## 🛡️ Security Features

- API key authentication for all endpoints
- Role-based access control (Agent/Lead roles)
- PII redaction in logs and traces
- Idempotency keys for critical operations
- Rate limiting with token bucket algorithm

## 📈 Observability

- **Metrics**: Prometheus-compatible metrics collection
- **Logging**: Structured JSON logs with PII redaction
- **Tracing**: Agent execution traces with performance data
- **Health Checks**: Database, Redis, and service health monitoring

## 🧪 Evaluation Framework

Run comprehensive evaluations with 12 golden test cases:

```bash
npm run eval
```

**Evaluation Metrics:**
- Task success rate (%)
- Fallback rate (%) and top failing tools
- Average agent latency (p50/p95)
- Policy denials by rule
- Confusion matrix for risk levels

## 📁 Project Structure

```
├── frontend/          # React TypeScript application
├── backend/           # NestJS TypeScript API
├── fixtures/          # Test data and golden cases
├── scripts/           # Evaluation and seeding scripts
├── docs/              # Architecture and design documents
├── docker-compose.yml # Multi-service orchestration
└── README.md          # This file
```

## 🔄 Development Workflow

1. **Local Development**: `docker-compose up -d`
2. **Testing**: `npm run test` (unit + integration)
3. **Evaluation**: `npm run eval` (golden cases)
4. **Performance**: `npm run perf` (load testing)
5. **Deployment**: `docker-compose -f docker-compose.prod.yml up -d`

## 📞 Support

For technical issues or questions:
- Check the API documentation at `/api/docs`
- Review the ADR.md for architectural decisions
- Run `npm run eval` to verify system health