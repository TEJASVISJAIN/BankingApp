# Demo Video Script - Aegis Banking Fraud Detection System

## Overview
This script demonstrates 3 key scenarios showcasing the multi-agent fraud detection system, including one fallback scenario and one policy block scenario.

**Duration**: 8-10 minutes
**Format**: Screen recording with voiceover

---

## Scene 1: Introduction (1 minute)

### Visual: System Overview Dashboard
**Voiceover**: "Welcome to the Aegis Banking Fraud Detection System. This is a multi-agent AI system designed to detect and triage fraud in real-time. Let me show you the key components."

### Key Points to Highlight:
- **Dashboard**: Show KPIs (Total Spend: ₹34.5B, Transactions: 1M, High Risk Alerts: 60K)
- **Architecture**: Multi-agent orchestration with specialized agents
- **Real-time Processing**: 5-second timeout for fraud decisions

---

## Scene 2: Scenario 1 - Card Lost with OTP (3 minutes)

### Visual: Customer Reports Lost Card
**Voiceover**: "Let's start with a common scenario - a customer reports their card as lost."

### Demo Flow:
1. **Customer Report**: Show customer message: "My card was stolen yesterday. Please freeze it immediately."
2. **Agent Orchestration**: 
   - Show plan_built event: ["getProfile", "getRecentTransactions", "riskSignals", "decide", "proposeAction"]
   - Show tool_update events for each agent
3. **Fraud Agent Analysis**: 
   - Risk score: 0.95 (high)
   - Recommendation: freeze_card
   - Requires OTP verification
4. **Action Execution**:
   - Generate OTP: "123456"
   - Send to customer phone
   - Validate OTP
   - Freeze card with status: "FROZEN"
5. **Final Assessment**: Show decision_finalized event with complete trace

### Key Features to Highlight:
- **Real-time SSE**: Show streaming updates in triage drawer
- **Multi-agent Coordination**: Each agent has specialized expertise
- **Security**: OTP verification for sensitive operations
- **Traceability**: Complete audit trail of agent decisions

---

## Scene 3: Scenario 2 - Service Timeout Fallback (3 minutes)

### Visual: Risk Service Timeout
**Voiceover**: "Now let's see how the system handles service failures with intelligent fallbacks."

### Demo Flow:
1. **Initial Request**: Customer transaction with suspicious pattern
2. **Service Timeout**: 
   - Show risk service timeout after 5 seconds
   - Display fallback_triggered event
   - Reason: "risk_unavailable"
3. **Rule-based Fallback**:
   - Show fallback to deterministic rules
   - Risk level capped at "medium" (not high)
   - Template-based response
4. **Final Decision**:
   - Status: "MANUAL_REVIEW"
   - Reason includes "risk_unavailable"
   - Confidence: 0.60 (lower due to fallback)

### Key Features to Highlight:
- **Circuit Breakers**: Automatic fallback on service failure
- **Graceful Degradation**: System continues to function
- **Transparency**: Clear indication of fallback reason
- **Compliance**: Banking regulations require 99.9% uptime

---

## Scene 4: Scenario 3 - Policy Block (3 minutes)

### Visual: Unauthorized Unfreeze Attempt
**Voiceover**: "Finally, let's see how the system enforces security policies and blocks unauthorized actions."

### Demo Flow:
1. **Policy Violation**: Customer attempts to unfreeze card without identity verification
2. **Compliance Agent Check**:
   - Show policy evaluation
   - Identity verification: false
   - Policy violation: "unfreeze_without_identity"
3. **Policy Block**:
   - Action: "deny"
   - Reason: "unfreeze_without_identity"
   - Handoff required: true
4. **Human Handoff**:
   - Escalate to senior agent
   - Manual review required
   - Security audit trail

### Key Features to Highlight:
- **Policy Enforcement**: Automated security policy checking
- **Security**: Prevents unauthorized actions
- **Audit Trail**: Complete logging of policy violations
- **Human Oversight**: Escalation for complex cases

---

## Scene 5: System Metrics & Observability (1 minute)

### Visual: Metrics Dashboard
**Voiceover**: "Let's look at the system's observability and performance metrics."

### Key Metrics to Show:
1. **Performance Metrics**:
   - Agent latency: P50: 1.2s, P95: 3.8s
   - Success rate: 94.2%
   - Fallback rate: 5.8%

2. **Security Metrics**:
   - PII redaction: 100% effective
   - Policy blocks: 12 this week
   - Rate limit hits: 0.1%

3. **System Health**:
   - Database: Healthy
   - Redis: Healthy
   - All services: Operational

### Key Features to Highlight:
- **Real-time Monitoring**: Live metrics and health checks
- **Performance Tracking**: Latency and success rates
- **Security Metrics**: PII protection and policy enforcement
- **Operational Excellence**: 99.9% uptime target

---

## Scene 6: Conclusion (1 minute)

### Visual: System Architecture Diagram
**Voiceover**: "The Aegis system demonstrates how multi-agent AI can be safely deployed in banking environments."

### Key Takeaways:
1. **Multi-Agent Orchestration**: Specialized agents working together
2. **Real-time Processing**: 5-second fraud decisions
3. **Robust Fallbacks**: System continues during failures
4. **Security First**: Policy enforcement and PII protection
5. **Full Observability**: Complete audit trails and metrics

### Call to Action:
- **GitHub**: [Repository link]
- **Documentation**: Full ADR and technical specs
- **Evaluation**: Run `npm run eval` for comprehensive testing

---

## Technical Notes for Recording:

### Screen Setup:
- **Main Screen**: Application dashboard and triage interface
- **Secondary Screen**: Terminal with logs and metrics
- **Recording**: 1920x1080, 30fps

### Audio:
- **Microphone**: Clear, professional voiceover
- **Background**: Minimal, non-distracting
- **Pace**: Moderate, clear pronunciation

### Timing:
- **Total Duration**: 8-10 minutes
- **Scene Transitions**: Smooth, 2-3 seconds
- **Pauses**: Natural breathing points

### Post-Production:
- **Intro/Outro**: 5-second fade in/out
- **Captions**: Key technical terms highlighted
- **Quality Check**: Audio levels, video clarity, timing