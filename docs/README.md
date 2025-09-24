# Aegis Support: Multi-Agent Banking Insights & Fraud Triage

A production-ready fraud detection system for banking operations, featuring multi-agent AI, real-time analysis, and comprehensive observability.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Express)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • Multi-Agent   │    │ • Transactions  │
│ • Triage UI     │    │ • Fraud Engine  │    │ • Customers     │
│ • Virtualized   │    │ • KB System     │    │ • Traces       │
│ • A11y Ready    │    │ • Observability │    │ • Redis Cache  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 6+

### Installation

1. **Clone and Setup**
```bash
git clone <repository-url>
cd Banking\ APP
npm install
```

2. **Start Services**
```bash
# Start all services
docker-compose up -d

# Or start individually
npm run docker:up
```

3. **Seed Data**
```bash
# Small dataset (10K transactions)
npm run seed-small

# Full dataset (1M transactions)
npm run seed
```

4. **Start Development**
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

5. **Access Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432
- Redis: localhost:6379

## 🧪 Testing & Evaluation

### Run Acceptance Tests
```bash
# All acceptance scenarios
npm run acceptance

# Performance verification
npm run perf-verify

# Golden evaluation set
npm run eval

# Performance optimization
npm run optimize
```

### Test Coverage
- ✅ 12 Golden test cases
- ✅ Performance targets (P95 ≤ 100ms)
- ✅ Accessibility compliance
- ✅ PII redaction verification
- ✅ Rate limiting behavior
- ✅ Fallback mechanisms

## 📊 Key Features

### 🎯 Multi-Agent System
- **Orchestrator**: Coordinates agent execution
- **Fraud Agent**: Rules-based fraud detection
- **KB Agent**: Knowledge base search with citations
- **Compliance Agent**: Policy enforcement
- **Redactor**: PII protection
- **Summarizer**: Report generation

### 🔒 Security & Compliance
- **PII Redaction**: Automatic sensitive data protection
- **OTP Verification**: Multi-factor authentication
- **Rate Limiting**: DoS protection
- **Circuit Breakers**: Fault tolerance
- **Audit Logging**: Complete action trails

### ⚡ Performance
- **Virtualized Tables**: Handle 1M+ transactions
- **Database Optimization**: Indexed queries, partitioning
- **Caching Strategy**: Redis-based performance
- **SSE Streaming**: Real-time updates
- **P95 ≤ 100ms**: Production-ready latency

### ♿ Accessibility
- **WCAG 2.1 AA**: Full compliance
- **Keyboard Navigation**: Complete keyboard support
- **Screen Reader**: ARIA labels and descriptions
- **Focus Management**: Proper focus trapping
- **High Contrast**: Visual accessibility

## 🛠️ API Documentation

### Core Endpoints

#### Authentication
All API endpoints require `X-API-Key` header:
```
X-API-Key: dev_key_789
```

#### Customer Operations
```bash
# Get customer transactions
GET /api/customer/{id}/transactions?last=90d

# Get customer insights
GET /api/insights/{id}/summary

# Get customer profile
GET /api/customer/{id}/profile
```

#### Fraud Triage
```bash
# Start triage session
POST /api/triage/start
{
  "customerId": "cust_001",
  "transactionId": "txn_001"
}

# Get session status
GET /api/triage/session/{sessionId}

# Stream updates
GET /api/triage/stream/{sessionId}
```

#### Actions
```bash
# Freeze card
POST /api/actions/freeze-card
{
  "cardId": "card_001",
  "customerId": "cust_001",
  "otp": "123456"
}

# Open dispute
POST /api/actions/open-dispute
{
  "txnId": "txn_001",
  "reasonCode": "10.4",
  "confirm": true
}

# Contact customer
POST /api/actions/contact-customer
{
  "customerId": "cust_001",
  "method": "phone",
  "reason": "Verification"
}
```

#### Knowledge Base
```bash
# Search KB
GET /api/kb/search?q=fraud+detection

# Add document
POST /api/kb/documents
{
  "title": "Fraud Detection Guide",
  "content": "...",
  "chunks": ["..."]
}
```

#### Evaluation & Metrics
```bash
# Run evaluation
POST /api/eval/run

# Get metrics
GET /api/eval/metrics

# Performance analysis
GET /api/eval/performance

# Confusion matrix
GET /api/eval/confusion-matrix
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aegis
REDIS_URL=redis://localhost:6379

# Security
API_KEY=dev_key_789
JWT_SECRET=your-secret-key

# Performance
LOG_LEVEL=info
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Observability
METRICS_ENABLED=true
TRACING_ENABLED=true
```

#### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Database Schema

#### Core Tables
- `customers`: Customer profiles and risk flags
- `cards`: Card information and status
- `transactions`: Transaction data (partitioned by month)
- `devices`: Device bindings and geo-location
- `chargebacks`: Dispute cases
- `kb_documents`: Knowledge base content

#### Observability Tables
- `agent_traces`: Agent execution traces
- `agent_steps`: Individual agent steps
- `risk_signals`: Risk assessment signals
- `request_logs`: API request logging
- `rate_limit_entries`: Rate limiting data

## 📈 Monitoring & Observability

### Metrics
- **Request Metrics**: Latency, throughput, error rates
- **Agent Metrics**: Execution time, success rates, fallbacks
- **Business Metrics**: Fraud detection rates, false positives
- **System Metrics**: CPU, memory, database performance

### Logging
- **Structured JSON**: Machine-readable logs
- **PII Redaction**: Automatic sensitive data protection
- **Correlation IDs**: Request tracing across services
- **Log Levels**: Debug, info, warn, error

### Tracing
- **Distributed Tracing**: End-to-end request tracking
- **Agent Steps**: Individual agent execution details
- **Performance Analysis**: Bottleneck identification
- **Error Tracking**: Failure point analysis

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Security audit completed

### Docker Deployment
```bash
# Build images
docker-compose build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up -d --scale backend=3
```

### Health Checks
```bash
# Application health
curl http://localhost:3001/health

# Database connectivity
curl http://localhost:3001/health/db

# Redis connectivity
curl http://localhost:3001/health/redis
```

## 🔍 Troubleshooting

### Common Issues

#### Performance Issues
```bash
# Check database performance
npm run perf-verify

# Analyze slow queries
docker exec -it postgres psql -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Monitor Redis
docker exec -it redis redis-cli monitor
```

#### Memory Issues
```bash
# Check memory usage
docker stats

# Analyze heap dumps
node --inspect backend/src/index.js
```

#### Database Issues
```bash
# Check connections
docker exec -it postgres psql -c "SELECT * FROM pg_stat_activity;"

# Analyze locks
docker exec -it postgres psql -c "SELECT * FROM pg_locks;"
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable tracing
TRACING_ENABLED=true npm run dev
```

## 📚 Additional Resources

### Documentation
- [API Reference](./API.md)
- [Architecture Decisions](./ADR.md)
- [Security Guide](./SECURITY.md)
- [Performance Guide](./PERFORMANCE.md)
- [Accessibility Guide](./ACCESSIBILITY.md)

### Scripts
- `npm run seed`: Generate 1M transactions
- `npm run eval`: Run golden evaluation set
- `npm run optimize`: Performance optimization
- `npm run acceptance`: Acceptance test scenarios
- `npm run perf-verify`: Performance verification

### Support
- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: [Full docs](https://docs.your-site.com)
- Security: [security@your-company.com](mailto:security@your-company.com)

---

**Built with ❤️ for banking security and fraud prevention**
