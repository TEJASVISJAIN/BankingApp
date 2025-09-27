-- Migration script to update database schema to match TypeORM entities
-- This script updates the existing schema to be compatible with our NestJS TypeORM entities

-- Update customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS preferences JSONB;

-- Update cards table  
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS lastFour VARCHAR(4),
ADD COLUMN IF NOT EXISTS brand VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update the last4 column to lastFour if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'last4') THEN
        ALTER TABLE cards RENAME COLUMN last4 TO lastFour;
    END IF;
END $$;

-- Update network column to brand if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'network') THEN
        ALTER TABLE cards RENAME COLUMN network TO brand;
    END IF;
END $$;

-- Update transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS deviceInfo JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update devices table
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS deviceType VARCHAR(50),
ADD COLUMN IF NOT EXISTS os VARCHAR(50),
ADD COLUMN IF NOT EXISTS osVersion VARCHAR(50),
ADD COLUMN IF NOT EXISTS appVersion VARCHAR(50),
ADD COLUMN IF NOT EXISTS deviceFingerprint VARCHAR(255),
ADD COLUMN IF NOT EXISTS firstSeen TIMESTAMP,
ADD COLUMN IF NOT EXISTS lastSeen TIMESTAMP,
ADD COLUMN IF NOT EXISTS isActive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS trustScore DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS location JSONB,
ADD COLUMN IF NOT EXISTS riskFlags JSONB;

-- Update chargebacks table
ALTER TABLE chargebacks
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS merchant VARCHAR(255),
ADD COLUMN IF NOT EXISTS mcc VARCHAR(10),
ADD COLUMN IF NOT EXISTS disputeDate TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolutionDate TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolution VARCHAR(255),
ADD COLUMN IF NOT EXISTS evidence JSONB;

-- Create actions table if it doesn't exist
CREATE TABLE IF NOT EXISTS actions (
    id VARCHAR(255) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    action_data JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Create kb_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS kb_documents (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    tags JSONB,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_traces table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_traces (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255),
    trace_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create request_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS request_logs (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    url VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    error_type VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing data to match new schema
UPDATE customers SET email = email_masked WHERE email IS NULL;
UPDATE customers SET phone = 'N/A' WHERE phone IS NULL;

-- Update cards data
UPDATE cards SET lastFour = lastFour WHERE lastFour IS NULL;
UPDATE cards SET brand = brand WHERE brand IS NULL;

-- Update transactions data
UPDATE transactions SET currency = 'INR' WHERE currency IS NULL;

-- Update devices data
UPDATE devices SET deviceType = 'unknown' WHERE deviceType IS NULL;
UPDATE devices SET os = 'unknown' WHERE os IS NULL;
UPDATE devices SET osVersion = 'unknown' WHERE osVersion IS NULL;
UPDATE devices SET appVersion = 'unknown' WHERE appVersion IS NULL;
UPDATE devices SET deviceFingerprint = 'unknown' WHERE deviceFingerprint IS NULL;
UPDATE devices SET firstSeen = created_at WHERE firstSeen IS NULL;
UPDATE devices SET lastSeen = updated_at WHERE lastSeen IS NULL;
UPDATE devices SET isActive = true WHERE isActive IS NULL;
UPDATE devices SET trustScore = 0.5 WHERE trustScore IS NULL;

-- Update chargebacks data
UPDATE chargebacks SET currency = 'INR' WHERE currency IS NULL;
UPDATE chargebacks SET merchant = 'Unknown' WHERE merchant IS NULL;
UPDATE chargebacks SET mcc = '0000' WHERE mcc IS NULL;
UPDATE chargebacks SET disputeDate = created_at WHERE disputeDate IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cards_customer_id ON cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer_id ON devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_customer_id ON chargebacks(customer_id);
CREATE INDEX IF NOT EXISTS idx_actions_customer_id ON actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_session_id ON agent_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_customer_id ON request_logs(customer_id);

-- Add comments for documentation
COMMENT ON TABLE customers IS 'Customer information and risk profiles';
COMMENT ON TABLE cards IS 'Customer payment cards';
COMMENT ON TABLE transactions IS 'Financial transactions';
COMMENT ON TABLE devices IS 'Customer devices and trust scores';
COMMENT ON TABLE chargebacks IS 'Dispute and chargeback records';
COMMENT ON TABLE actions IS 'Customer service actions taken';
COMMENT ON TABLE kb_documents IS 'Knowledge base documents';
COMMENT ON TABLE agent_traces IS 'AI agent execution traces';
COMMENT ON TABLE request_logs IS 'API request logging';
