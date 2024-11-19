# CRM Bulk Action Platform

A highly scalable and efficient bulk action platform for CRM applications, capable of processing millions of entities with robust error handling, monitoring, and extensibility.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Design Decisions](#design-decisions)
4. [Key Components](#key-components)
5. [Data Models](#data-models)
6. [API Documentation](#api-documentation)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Performance Considerations](#performance-considerations)
9. [Security Features](#security-features)

## System Architecture

### High-Level Design

```
Client Requests → API Layer → Kafka → Consumer Workers → Database
     ↑                ↓                     ↓                ↓
     └── API Response ← ────── ClickHouse Logging ─── PostgreSQL
```

### Key Components Flow

1. **API Layer**: Handles incoming requests, authentication, and rate limiting
2. **Message Queue**: Kafka for reliable message processing and scalability
3. **Consumer Workers**: Process bulk operations in batches
4. **Databases**:
   - PostgreSQL for entity storage
   - ClickHouse for operational logging and analytics

## Technology Stack

### Core Technologies

- **Backend**: Node.js with TypeScript
- **API Framework**: Express.js
- **Message Queue**: Apache Kafka
- **Databases**:
  - PostgreSQL (Primary database)
  - ClickHouse (Logging and analytics)
- **Caching/Rate Limiting**: Redis
- **Authentication**: JWT

### Key Libraries

- `kafkajs` - Kafka client
- `@clickhouse/client` - ClickHouse integration
- `pg` - PostgreSQL client
- `redis` - Redis client for rate limiting
- `zod` - Schema validation

## Design Decisions

### 1. Database Choices

#### PostgreSQL for Entity Storage

- **Why**:
  - ACID compliance for critical business data
  - Strong consistency requirements
  - Complex querying capabilities
  - Rich ecosystem and tooling
- **Trade-offs**:
  - More complex scaling compared to NoSQL
  - Higher storage costs
  - Need for careful index management

#### ClickHouse for Logging

- **Why**:
  - Optimized for write-heavy logging operations
  - Excellent query performance for analytics
  - Column-oriented storage perfect for log analysis
  - Efficient storage compression
- **Trade-offs**:
  - Limited transaction support
  - Not suitable for frequent updates
  - Higher learning curve

### 2. Message Queue Selection

#### Apache Kafka

- **Why**:
  - High throughput for large-scale operations
  - Reliable message delivery
  - Built-in partitioning for scalability
  - Message persistence
  - Stream processing capabilities
- **Trade-offs**:
  - More complex setup and maintenance
  - Higher resource requirements
  - Steeper learning curve than simpler queues

### 3. Rate Limiting Strategy

#### Dual-Layer Rate Limiting

1. **API Layer**:

   - Redis-based rate limiting
   - Per-account limits
   - Immediate feedback to clients

2. **Processing Layer**:
   - Kafka consumer-based rate limiting
   - Prevents system overload
   - Handles backpressure

### 4. Error Handling and Retry Strategy

#### Fixed Interval Retry

- **Why**:
  - Predictable retry behavior
  - Simpler to reason about and monitor
  - Sufficient for most transient failures
- **Implementation**:
  - 3 retry attempts
  - 1-second fixed interval
  - Detailed error logging

## Key Components

### 1. Contact Entity Management

- CRUD operations
- Batch processing capabilities
- Duplicate detection
- Input validation using Zod

### 2. Bulk Action Processing

- Batch-based processing
- Progress tracking
- Error handling
- Rate limiting
- Scheduling support

### 3. Logging and Monitoring

- Detailed operation logging
- Error tracking
- Performance metrics
- Time-series analysis

## Data Models

### PostgreSQL Schema

```sql
-- Key tables structure and relationships
-- See database schema in implementation
```

### ClickHouse Schema

```sql
-- Logging table structure
-- See logging implementation
```

## API Documentation

### Authentication Endpoints

- `POST /auth/register`
- `POST /auth/login`

### Bulk Action Endpoints

- `POST /bulk-actions`
- `GET /bulk-actions`
- `GET /bulk-actions/{id}`
- `GET /bulk-actions/{id}/stats`
- `GET /bulk-actions/{id}/logs`
- `GET /bulk-actions/{id}/errors`

### Contact Endpoints

- `POST /contacts`
- `GET /contacts/{id}`
- `PUT /contacts/{id}`
- `DELETE /contacts/{id}`
- `GET /contacts`

## Performance Considerations

### Scalability

- Horizontal scaling of Kafka consumers
- Database connection pooling
- Batch processing for bulk operations
- Redis caching for rate limiting

### Optimization

- Indexed database queries
- Efficient logging with ClickHouse
- Batch size tuning
- Rate limiting to prevent overload

## Security Features

### Authentication

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control

### Rate Limiting

- Per-account rate limiting
- DDoS protection
- Processing rate limits

### Data Validation

- Input validation using Zod
- SQL injection prevention
- XSS protection

## Monitoring and Logging

### Metrics Tracked

- Processing time
- Error rates
- Success rates
- Queue lengths
- Rate limit hits

### Log Analysis

- Real-time error tracking
- Performance monitoring
- Time-series analysis
- Error pattern detection
