import { KafkaConsumerService } from '../../../src/services/bulk/kafkaConsumer';
import { BulkActionService } from '../../../src/services/bulk/bulkActionService';
import { ContactService } from '../../../src/services/contact/contactService';
import { RetryService } from '../../../src/services/bulk/retryService';
import { ProcessRateLimiter } from '../../../src/services/rateLimit/processRateLimiter';
import { LoggerService, LogLevel, OperationType } from '../../../src/services/logging/loggingService';
import { Contact } from '../../../src/models/contact';
import { kafka } from '../../../src/config/kafka';
import { createMockEachMessagePayload, createMockBulkActionMessage } from "../../helpers/kafkaUtils"

// Mock all dependencies
jest.mock('../../../src/config/kafka');
jest.mock('../../../src/services/bulk/bulkActionService');
jest.mock('../../../src/services/contact/contactService');
jest.mock('../../../src/services/bulk/retryService');
jest.mock('../../../src/services/rateLimit/processRateLimiter');
jest.mock('../../../src/services/logging/loggingService');

describe('KafkaConsumerService', () => {
    let consumerService: KafkaConsumerService;
    let mockBulkActionService: jest.Mocked<BulkActionService>;
    let mockContactService: jest.Mocked<ContactService>;
    let mockRetryService: jest.Mocked<RetryService>;
    let mockRateLimiter: jest.Mocked<ProcessRateLimiter>;
    let mockLogger: jest.Mocked<LoggerService>;
    let mockKafkaConsumer: any;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        mockBulkActionService = {
            updateStatus: jest.fn(),
            createBatch: jest.fn(),
            updateBatchStatus: jest.fn(),
            updateProgress: jest.fn()
        } as any;

        mockContactService = {
            getTotalCount: jest.fn(),
            getBatch: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn()
        } as any;

        mockRetryService = {
            retry: jest.fn()
        } as any;

        mockRateLimiter = {
            checkProcessingLimit: jest.fn()
        } as any;

        mockLogger = {
            log: jest.fn(),
            getInstance: jest.fn().mockReturnThis()
        } as any;

        // Setup Kafka consumer mock
        mockKafkaConsumer = {
            connect: jest.fn(),
            subscribe: jest.fn(),
            run: jest.fn(),
            disconnect: jest.fn()
        };

        (kafka.consumer as jest.Mock).mockReturnValue(mockKafkaConsumer);

        // Mock LoggerService.getInstance
        (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLogger);

        // Create new instance with injected mocks
        consumerService = new KafkaConsumerService();
        // Manually inject mocked services
        (consumerService as any).bulkActionService = mockBulkActionService;
        (consumerService as any).contactService = mockContactService;
        (consumerService as any).retryService = mockRetryService;
        (consumerService as any).rateLimiter = mockRateLimiter;
        (consumerService as any).logger = mockLogger;
    });

    const mockMessagePayload = {
        topic: 'bulk-actions',
        partition: 0,
        message: {
            key: Buffer.from('1'),
            value: Buffer.from(JSON.stringify({
                actionId: 1,
                accountId: 1,
                actionType: 'UPDATE',
                configuration: {
                    updates: { status: 'active' },
                    filters: { status: 'inactive' },
                    batchSize: 100
                }
            })),
            timestamp: '1234567890',
            size: 0,
            attributes: 0,
            offset: '0'
        },
        heartbeat: jest.fn(),
        pause: jest.fn()
    };

    const mockContacts: Contact[] = [
        {
            id: 1,
            email: 'test1@example.com',
            name: 'Test User 1',
            age: 25,
            metadata: { department: 'Engineering' },
            created_at: new Date(),
            updated_at: new Date()
        },
        {
            id: 2,
            email: 'test2@example.com',
            name: 'Test User 2',
            age: 30,
            metadata: { department: 'Sales' },
            created_at: new Date(),
            updated_at: new Date()
        }
    ];



    describe('processMessage', () => {
        it('should process message successfully when rate limit is not exceeded', async () => {
            // Setup mock returns
            mockRateLimiter.checkProcessingLimit.mockResolvedValue(true);
            mockContactService.getTotalCount.mockResolvedValue(150);
            mockContactService.getBatch.mockResolvedValue([
                { id: 1, email: 'test1@example.com', name: 'Test 1' } as Contact
            ]);
            mockBulkActionService.createBatch.mockResolvedValue({ id: 1 });
            mockRetryService.retry.mockImplementation((fn) => fn());

            // Get message handler
            await consumerService.start();
            const messageHandler = mockKafkaConsumer.run.mock.calls[0][0].eachMessage;
            await messageHandler(mockMessagePayload);

            expect(mockRateLimiter.checkProcessingLimit).toHaveBeenCalledWith('1');
            expect(mockBulkActionService.updateStatus).toHaveBeenCalledWith(1, 'processing');
            expect(mockContactService.getTotalCount).toHaveBeenCalled();
        });

        it('should handle rate limit exceeded', async () => {
            mockRateLimiter.checkProcessingLimit.mockResolvedValue(false);

            await consumerService.start();
            const messageHandler = mockKafkaConsumer.run.mock.calls[0][0].eachMessage;
            await messageHandler(mockMessagePayload);

            expect(mockBulkActionService.updateStatus).not.toHaveBeenCalled();
        });

        it('should process email updates with duplicate checking', async () => {
            const emailUpdateMessage = createMockEachMessagePayload(createMockBulkActionMessage({
                configuration: {
                    updates: {
                        email: 'newemail@example.com',
                        name: 'Updated Name'
                    },
                    batchSize: 100
                }
            }));

            mockRateLimiter.checkProcessingLimit.mockResolvedValue(true);
            mockContactService.getTotalCount.mockResolvedValue(2);
            mockContactService.getBatch.mockResolvedValue(mockContacts);
            mockBulkActionService.createBatch.mockResolvedValue({ id: 1 });
            mockContactService.findByEmail.mockResolvedValue({
                ...mockContacts[0],
                email: 'newemail@example.com'
            });

            await consumerService.start();
            const messageHandler = mockKafkaConsumer.run.mock.calls[0][0].eachMessage;
            await messageHandler(emailUpdateMessage);

            expect(mockContactService.findByEmail).toHaveBeenCalledWith('newemail@example.com');
            expect(mockLogger.log).toHaveBeenCalledWith(expect.objectContaining({
                status: 'skipped',
                level: LogLevel.INFO,
                message: expect.stringContaining('Skipped entity')
            }));
        });

    });
});