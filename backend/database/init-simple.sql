-- Simple database initialization for Aegis Support
-- PostgreSQL with basic tables (no partitioning for now)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE action_status AS ENUM ('pending', 'approved', 'denied', 'completed');
CREATE TYPE agent_status AS ENUM ('idle', 'running', 'completed', 'failed');
CREATE TYPE step_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE signal_type AS ENUM ('velocity', 'amount', 'location', 'merchant', 'device', 'time');
CREATE TYPE signal_severity AS ENUM ('low', 'medium', 'high');

-- Customers table
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email_masked VARCHAR(255) NOT NULL,
    risk_flags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards table
CREATE TABLE cards (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
    last4 VARCHAR(4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    network VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table (simplified, no partitioning)
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    card_id VARCHAR(50) NOT NULL REFERENCES cards(id),
    mcc VARCHAR(10) NOT NULL,
    merchant VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    device_id VARCHAR(50),
    geo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chargebacks table
CREATE TABLE chargebacks (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
    transaction_id VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    reason_code VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices table
CREATE TABLE devices (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
    device_type VARCHAR(50),
    device_info JSONB,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base documents
CREATE TABLE kb_documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    anchor VARCHAR(100),
    content TEXT NOT NULL,
    chunks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent traces for audit and debugging
CREATE TABLE agent_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    trace_data JSONB NOT NULL,
    status agent_status NOT NULL DEFAULT 'idle',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Actions taken by agents
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB NOT NULL,
    status action_status NOT NULL DEFAULT 'pending',
    policy_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Evaluation results
CREATE TABLE eval_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    eval_name VARCHAR(100) NOT NULL,
    test_case JSONB NOT NULL,
    expected_result JSONB,
    actual_result JSONB,
    passed BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
-- Customer transaction queries (most common)
CREATE INDEX idx_transactions_customer_ts ON transactions (customer_id, ts DESC);
CREATE INDEX idx_transactions_customer_card ON transactions (customer_id, card_id, ts DESC);

-- Merchant and category analysis
CREATE INDEX idx_transactions_merchant ON transactions (merchant);
CREATE INDEX idx_transactions_mcc ON transactions (mcc);

-- Time-based queries
CREATE INDEX idx_transactions_ts ON transactions (ts DESC);

-- Full-text search on merchant names
CREATE INDEX idx_transactions_merchant_gin ON transactions USING gin (merchant gin_trgm_ops);

-- Knowledge base search
CREATE INDEX idx_kb_documents_content_gin ON kb_documents USING gin (to_tsvector('english', content));
CREATE INDEX idx_kb_documents_title ON kb_documents (title);

-- Agent traces
CREATE INDEX idx_agent_traces_session ON agent_traces (session_id);
CREATE INDEX idx_agent_traces_customer ON agent_traces (customer_id);
CREATE INDEX idx_agent_traces_created ON agent_traces (created_at);

-- Actions
CREATE INDEX idx_actions_session ON actions (session_id);
CREATE INDEX idx_actions_customer ON actions (customer_id);
CREATE INDEX idx_actions_type ON actions (action_type);
CREATE INDEX idx_actions_status ON actions (status);

-- Evaluation results
CREATE INDEX idx_eval_results_name ON eval_results (eval_name);
CREATE INDEX idx_eval_results_passed ON eval_results (passed);
CREATE INDEX idx_eval_results_created ON eval_results (created_at);

-- Agent traces table
CREATE TABLE agent_traces (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(50) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- milliseconds
    status agent_status NOT NULL DEFAULT 'running',
    risk_score INTEGER DEFAULT 0,
    risk_level risk_level DEFAULT 'low',
    recommendation VARCHAR(50) DEFAULT 'monitor',
    confidence DECIMAL(3,2) DEFAULT 0.0,
    fallbacks JSONB DEFAULT '[]'::jsonb,
    policy_blocks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent steps table
CREATE TABLE agent_steps (
    id SERIAL PRIMARY KEY,
    trace_id INTEGER NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    agent VARCHAR(50) NOT NULL,
    tool VARCHAR(50) NOT NULL,
    status step_status NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- milliseconds
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk signals table
CREATE TABLE risk_signals (
    id SERIAL PRIMARY KEY,
    trace_id INTEGER NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
    signal_type signal_type NOT NULL,
    severity signal_severity NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent traces
CREATE INDEX idx_agent_traces_session ON agent_traces (session_id);
CREATE INDEX idx_agent_traces_customer ON agent_traces (customer_id);
CREATE INDEX idx_agent_traces_transaction ON agent_traces (transaction_id);
CREATE INDEX idx_agent_traces_start_time ON agent_traces (start_time);
CREATE INDEX idx_agent_traces_status ON agent_traces (status);
CREATE INDEX idx_agent_traces_risk_level ON agent_traces (risk_level);

-- Indexes for agent steps
CREATE INDEX idx_agent_steps_trace ON agent_steps (trace_id);
CREATE INDEX idx_agent_steps_step_id ON agent_steps (step_id);
CREATE INDEX idx_agent_steps_agent ON agent_steps (agent);
CREATE INDEX idx_agent_steps_tool ON agent_steps (tool);
CREATE INDEX idx_agent_steps_status ON agent_steps (status);
CREATE INDEX idx_agent_steps_start_time ON agent_steps (start_time);

-- Indexes for risk signals
CREATE INDEX idx_risk_signals_trace ON risk_signals (trace_id);
CREATE INDEX idx_risk_signals_type ON risk_signals (signal_type);
CREATE INDEX idx_risk_signals_severity ON risk_signals (severity);
CREATE INDEX idx_risk_signals_score ON risk_signals (score);

-- OTP requests table
CREATE TABLE otp_requests (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for OTP requests
CREATE INDEX idx_otp_requests_customer ON otp_requests (customer_id);
CREATE INDEX idx_otp_requests_action ON otp_requests (action);
CREATE INDEX idx_otp_requests_status ON otp_requests (status);
CREATE INDEX idx_otp_requests_expires ON otp_requests (expires_at);

-- Rate limiting table
CREATE TABLE rate_limit_entries (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for rate limiting
CREATE INDEX idx_rate_limit_entries_key ON rate_limit_entries (key);
CREATE INDEX idx_rate_limit_entries_created ON rate_limit_entries (created_at);

-- Request logs table for observability
CREATE TABLE request_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    url VARCHAR(500) NOT NULL,
    status INTEGER NOT NULL,
    duration INTEGER,
    error_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for request logs
CREATE INDEX idx_request_logs_created ON request_logs (created_at);
CREATE INDEX idx_request_logs_status ON request_logs (status);
CREATE INDEX idx_request_logs_error ON request_logs (error_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chargebacks_updated_at BEFORE UPDATE ON chargebacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_documents_updated_at BEFORE UPDATE ON kb_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
