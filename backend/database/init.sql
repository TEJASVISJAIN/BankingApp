-- Aegis Support Database Schema
-- PostgreSQL with monthly partitioning for transactions

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

-- Create partitioned transactions table
CREATE TABLE transactions (
    id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    card_id VARCHAR(50) NOT NULL REFERENCES cards(id),
    mcc VARCHAR(10) NOT NULL,
    merchant VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    device_id VARCHAR(50),
    geo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Create monthly partitions for transactions (example for 2024-2025)
CREATE TABLE transactions_2024_01 PARTITION OF transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE transactions_2024_02 PARTITION OF transactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE transactions_2024_03 PARTITION OF transactions
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE transactions_2024_04 PARTITION OF transactions
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE transactions_2024_05 PARTITION OF transactions
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE transactions_2024_06 PARTITION OF transactions
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE transactions_2024_07 PARTITION OF transactions
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE transactions_2024_08 PARTITION OF transactions
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE transactions_2024_09 PARTITION OF transactions
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE transactions_2024_10 PARTITION OF transactions
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE transactions_2024_11 PARTITION OF transactions
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE transactions_2024_12 PARTITION OF transactions
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE transactions_2025_01 PARTITION OF transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE transactions_2025_02 PARTITION OF transactions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE transactions_2025_03 PARTITION OF transactions
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE transactions_2025_04 PARTITION OF transactions
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE transactions_2025_05 PARTITION OF transactions
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE transactions_2025_06 PARTITION OF transactions
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE transactions_2025_07 PARTITION OF transactions
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE transactions_2025_08 PARTITION OF transactions
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE transactions_2025_09 PARTITION OF transactions
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE transactions_2025_10 PARTITION OF transactions
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE transactions_2025_11 PARTITION OF transactions
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE transactions_2025_12 PARTITION OF transactions
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

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

-- Create functions for automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically create partitions for future months
CREATE OR REPLACE FUNCTION create_future_partitions()
RETURNS void AS $$
DECLARE
    current_date date := date_trunc('month', CURRENT_DATE);
    i integer;
BEGIN
    -- Create partitions for next 12 months
    FOR i IN 0..11 LOOP
        PERFORM create_monthly_partition('transactions', current_date + (i || ' months')::interval);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function for PII redaction
CREATE OR REPLACE FUNCTION redact_pii(input_text text)
RETURNS text AS $$
BEGIN
    -- Redact PAN-like numbers (13-19 digits)
    input_text := regexp_replace(input_text, '\b\d{13,19}\b', '****REDACTED****', 'g');
    
    -- Redact email addresses
    input_text := regexp_replace(input_text, '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', 
                                'f***@d***.com', 'g');
    
    RETURN input_text;
END;
$$ LANGUAGE plpgsql;

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

-- Create future partitions
SELECT create_future_partitions();
