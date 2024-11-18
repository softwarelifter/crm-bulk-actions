-- init.sql
CREATE DATABASE crm_bulk_actions;

\connect crm_bulk_actions;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rate_limit_per_minute INTEGER DEFAULT 10000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User accounts mapping
CREATE TABLE IF NOT EXISTS user_accounts (
    user_id INTEGER REFERENCES users(id),
    account_id INTEGER REFERENCES accounts(id),
    role VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, account_id)
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bulk actions table
CREATE TABLE IF NOT EXISTS bulk_actions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    skipped_records INTEGER DEFAULT 0,
    scheduled_for TIMESTAMP,
    configuration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'scheduled'))
);

-- Bulk action batches table
CREATE TABLE IF NOT EXISTS bulk_action_batches (
    id SERIAL PRIMARY KEY,
    bulk_action_id INTEGER REFERENCES bulk_actions(id),
    batch_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);