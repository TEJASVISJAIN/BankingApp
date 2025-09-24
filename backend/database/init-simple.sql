-- Simple database initialization for Aegis Support
-- PostgreSQL with basic tables (no partitioning for now)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE action_status AS ENUM ('pending', 'approved', 'denied', 'completed');
CREATE TYPE agent_status AS ENUM ('idle', 'running', 'completed', 'failed');

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
