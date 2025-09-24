# Acceptance Scenarios

This document outlines the acceptance scenarios that the Aegis Support system must pass to be considered production-ready.

## 🎯 Core Scenarios

### 1. Freeze Flow with OTP
**Input**: Alert for `cust_017/card_093`; user clicks Freeze; system asks OTP; submit "123456"

**Expected**:
- ✅ Status: `FROZEN`
- ✅ Trace shows `freezeCard` ok
- ✅ Metric `action_blocked_total{policy=otp_required}` increases before final success
- ✅ Redacted logs with `masked=true`

**Test Command**:
```bash
npm run acceptance
```

### 2. Dispute Creation
**Input**: Unrecognized ₹4,999 "ABC Mart" yesterday

**Expected**:
- ✅ One matching transaction found
- ✅ Agent proposes reason `10.4`
- ✅ After confirm, case opened
- ✅ Timeline updated
- ✅ Citation to "How disputes work (#kb_disputes)"

### 3. Duplicate Pending vs Captured
**Input**: "Charged twice at QuickCab"

**Expected**:
- ✅ Explanation (preauth vs capture)
- ✅ No dispute created
- ✅ Risk downgraded
- ✅ Trace shows KB Agent usage

### 4. Risk Service Timeout → Fallback
**Input**: Simulate failure for `riskSignals`

**Expected**:
- ✅ `fallbackUsed=true`
- ✅ Risk at most medium
- ✅ Reason includes `risk_unavailable`
- ✅ SSE shows `fallback_triggered`

### 5. 429 Rate Limit Behavior
**Input**: Spam triage; first call returns 429 with `retryAfterMs=2000`

**Expected**:
- ✅ FE disables action for ~2s
- ✅ Shows message
- ✅ No duplicate triage runs
- ✅ Next attempt succeeds

### 6. PII in Input
**Input**: User message contains `4111111111111111`

**Expected**:
- ✅ Never echoed
- ✅ Trace shows redactor applied
- ✅ Log has `masked=true`

### 7. Performance
**Input**: `/customer/:id/transactions?last=90d` on 1M rows (local)

**Expected**:
- ✅ P95 ≤ 100ms
- ✅ Provide screenshot or timing output

## 🚫 Do-Not List

### ❌ Prohibited Shortcuts
- **No external network calls** in core flow (optional LLM path must be toggleable and have deterministic fallback)
- **No hard-coding** of acceptance outputs; traces must reflect real steps
- **No disabling** rate limit/idempotency to pass tests
- **No plaintext PII** in logs, traces, or UI—automatic fail

## 🧪 Running Tests

### Prerequisites
```bash
# Start the system
docker-compose up -d

# Seed test data
npm run seed-small

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev
```

### Run All Acceptance Tests
```bash
npm run acceptance
```

### Run Individual Tests
```bash
# Golden evaluation set
npm run eval

# Performance optimization
npm run optimize

# API testing
npm run test-api
```

## 📊 Expected Results

### Success Criteria
- **All 7 scenarios must pass**
- **Performance targets met** (P95 ≤ 100ms)
- **No PII leakage** in any output
- **Proper fallback behavior** when services fail
- **Rate limiting works** as expected
- **OTP flow complete** end-to-end

### Metrics to Verify
```bash
# Check metrics endpoint
curl -H "X-API-Key: dev_key_789" http://localhost:3001/metrics

# Check health
curl -H "X-API-Key: dev_key_789" http://localhost:3001/health

# Check circuit breakers
curl -H "X-API-Key: dev_key_789" http://localhost:3001/api/eval/circuit-breakers
```

## 🔍 Verification Checklist

### ✅ Freeze Flow
- [ ] OTP required for high-risk freeze
- [ ] Card frozen after valid OTP
- [ ] Metrics show policy enforcement
- [ ] Logs are properly redacted

### ✅ Dispute Creation
- [ ] Transaction matched correctly
- [ ] Reason code 10.4 proposed
- [ ] Case opened successfully
- [ ] KB citation included

### ✅ Duplicate Handling
- [ ] Risk level downgraded
- [ ] No dispute created
- [ ] KB Agent used in trace
- [ ] Explanation provided

### ✅ Fallback Behavior
- [ ] Fallback triggered on timeout
- [ ] Risk level capped at medium
- [ ] SSE event sent
- [ ] Reason includes unavailability

### ✅ Rate Limiting
- [ ] 429 returned when limit exceeded
- [ ] Retry-After header present
- [ ] No duplicate processing
- [ ] Success after retry period

### ✅ PII Protection
- [ ] No PII in responses
- [ ] Redaction applied in traces
- [ ] Logs marked as masked
- [ ] No plaintext sensitive data

### ✅ Performance
- [ ] P95 ≤ 100ms achieved
- [ ] 1M+ transactions handled
- [ ] Database indexes optimized
- [ ] Caching working effectively

## 🎯 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| P95 Latency | ≤ 100ms | ✅ |
| P99 Latency | ≤ 200ms | ✅ |
| Error Rate | ≤ 1% | ✅ |
| Throughput | ≥ 1000 req/s | ✅ |
| OTP Success Rate | 100% | ✅ |
| PII Redaction | 100% | ✅ |
| Fallback Rate | < 5% | ✅ |

## 🚀 Production Readiness

The system is considered production-ready when:
1. **All acceptance scenarios pass**
2. **Performance targets met**
3. **Security requirements satisfied**
4. **Observability complete**
5. **Documentation updated**

---

**Note**: These scenarios test the complete end-to-end functionality and ensure the system meets all production requirements for a banking fraud detection system.
