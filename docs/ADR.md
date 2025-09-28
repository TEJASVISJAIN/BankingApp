# Architecture Decision Records (ADR)

## ADR-001: Multi-Agent Orchestration vs. Single LLM

**Decision**: Implement multi-agent orchestration with specialized agents
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need to handle complex fraud detection scenarios with different types of analysis (risk scoring, knowledge lookup, compliance checking).

**Decision**: Use a multi-agent system with specialized agents:
- Fraud Agent: Risk scoring and pattern detection
- Insights Agent: Transaction analysis and categorization  
- KB Agent: Knowledge base search and citation
- Compliance Agent: Policy enforcement
- Redactor: PII detection and sanitization

**Rationale**: 
- **Pros**: Specialized expertise, better error isolation, easier testing
- **Cons**: Higher complexity, more coordination overhead
- **Trade-off**: Complexity vs. maintainability and accuracy

## ADR-002: Database Partitioning Strategy

**Decision**: Monthly partitioning for transactions table
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need to support 1M+ transactions with sub-100ms query performance.

**Decision**: Partition transactions table by month with composite indexes:
- Primary key: (customer_id, ts DESC)
- Secondary: (mcc, ts DESC), (merchant, ts DESC)

**Rationale**:
- **Pros**: Query performance, parallel processing, easier maintenance
- **Cons**: Complex query logic, cross-partition operations
- **Trade-off**: Performance vs. query complexity

## ADR-003: Fallback Policy for Agent Failures

**Decision**: Rule-based fallbacks with circuit breakers
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Banking systems require 99.9% uptime even during LLM service outages.

**Decision**: Implement cascading fallbacks:
1. Primary: Multi-agent LLM orchestration
2. Secondary: Rule-based risk scoring
3. Tertiary: Manual review queue

**Rationale**:
- **Pros**: Guaranteed response, compliance with banking regulations
- **Cons**: Lower accuracy during outages
- **Trade-off**: Reliability vs. accuracy

## ADR-004: Real-time vs. Batch Processing

**Decision**: Real-time triage with 5-second timeout
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Fraud detection requires immediate response to prevent losses.

**Decision**: Real-time processing with strict timeouts:
- Tool calls: ≤ 1s timeout
- Total flow: ≤ 5s timeout
- Circuit breaker: 30s after 3 consecutive failures

**Rationale**:
- **Pros**: Immediate fraud prevention, better user experience
- **Cons**: Higher infrastructure costs, more complex error handling
- **Trade-off**: Cost vs. fraud prevention effectiveness

## ADR-005: PII Redaction Strategy

**Decision**: Application-level redaction with selective analytics
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Banking regulations require strict PII protection while maintaining analytics capabilities.

**Decision**: Multi-layer PII protection:
- Log redaction: PAN numbers, emails, phone numbers
- Trace sanitization: Customer data in agent traces
- Analytics: Aggregated data only, no individual PII

**Rationale**:
- **Pros**: Compliance, customer trust, audit trail
- **Cons**: Limited historical analysis, complex redaction logic
- **Trade-off**: Privacy vs. analytics capabilities

## ADR-006: Rate Limiting Implementation

**Decision**: Token bucket algorithm with Redis backend
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need to prevent abuse while allowing legitimate high-volume operations.

**Decision**: Token bucket with 5 req/s per session:
- Bucket size: 10 tokens
- Refill rate: 5 tokens/second
- Backoff: Exponential with jitter

**Rationale**:
- **Pros**: Smooth rate limiting, burst handling, Redis scalability
- **Cons**: Redis dependency, memory usage
- **Trade-off**: Complexity vs. performance

## ADR-007: SSE vs. WebSocket for Real-time Updates

**Decision**: Server-Sent Events (SSE) for agent progress streaming
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need to stream agent execution progress to frontend in real-time.

**Decision**: SSE for unidirectional streaming:
- Events: plan_built, tool_update, fallback_triggered, decision_finalized
- Connection management: Heartbeat, timeout, cleanup
- Fallback: Polling for SSE-unavailable clients

**Rationale**:
- **Pros**: Simpler than WebSocket, built-in reconnection, HTTP/2 compatible
- **Cons**: Unidirectional only, browser connection limits
- **Trade-off**: Simplicity vs. bidirectional communication

## ADR-008: Idempotency Implementation

**Decision**: Redis-based idempotency with Idempotency-Key header
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Critical operations (ingestion, actions) must be idempotent to prevent duplicates.

**Decision**: Header-based idempotency:
- Header: `Idempotency-Key: <uuid>`
- Storage: Redis with 24h TTL
- Scope: Per-endpoint, per-user session

**Rationale**:
- **Pros**: Prevents duplicate operations, audit trail, Redis performance
- **Cons**: Redis dependency, key management complexity
- **Trade-off**: Reliability vs. infrastructure complexity

## ADR-009: Frontend State Management

**Decision**: React Context + useReducer for complex state
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need to manage complex application state (triage sessions, real-time updates, large datasets).

**Decision**: Hybrid approach:
- Context: Global state (user, session, settings)
- Local state: Component-specific state
- Virtualization: For large transaction lists

**Rationale**:
- **Pros**: Simpler than Redux, good performance, React-native patterns
- **Cons**: Prop drilling potential, less tooling
- **Trade-off**: Simplicity vs. scalability

## ADR-010: Error Handling Strategy

**Decision**: Structured error responses with fallback actions
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Banking systems require graceful error handling with clear user communication.

**Decision**: Multi-level error handling:
- API: Structured error responses with error codes
- Frontend: Error boundaries with fallback UI
- Agents: Circuit breakers with fallback policies

**Rationale**:
- **Pros**: Better user experience, easier debugging, compliance
- **Cons**: More complex error handling logic
- **Trade-off**: User experience vs. development complexity

## ADR-011: Testing Strategy

**Decision**: Golden case evaluation with automated testing
**Status**: Accepted
**Date**: 2025-01-15

**Context**: AI systems require different testing approaches than traditional software.

**Decision**: Multi-layered testing:
- Unit tests: Individual agent functions
- Integration tests: API endpoints and database
- Golden cases: 12 comprehensive scenarios
- Performance tests: Load testing with 1M+ records

**Rationale**:
- **Pros**: Comprehensive coverage, AI-specific testing, performance validation
- **Cons**: More test maintenance, complex setup
- **Trade-off**: Quality vs. development overhead

## ADR-012: Deployment Strategy

**Decision**: Docker Compose for development, Kubernetes for production
**Status**: Accepted
**Date**: 2025-01-15

**Context**: Need consistent deployment across development and production environments.

**Decision**: Multi-environment approach:
- Development: Docker Compose with hot reload
- Staging: Docker Compose with production-like config
- Production: Kubernetes with auto-scaling

**Rationale**:
- **Pros**: Environment consistency, easy local development, production scalability
- **Cons**: Docker complexity, Kubernetes learning curve
- **Trade-off**: Development ease vs. production requirements