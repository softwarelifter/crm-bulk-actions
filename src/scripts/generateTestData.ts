import { ContactService } from '../services/contact/contactService.js';
import { AuthService } from '../services/auth/authService.js';

async function generateTestData() {
    const authService = new AuthService();
    const contactService = new ContactService();

    try {
        // Create test user and account
        console.log('Creating test user...');
        const user = await authService.findByEmail('test@example.com');
        console.log('Test user created:', user);

        // Generate sample contacts
        console.log('Generating sample contacts...');
        const companies = ['Acme Inc', 'TechCorp', 'DevCo'];
        const roles = ['Developer', 'Manager', 'Designer'];

        for (let i = 0; i < 1000; i++) {
            const contact = await contactService.create({
                email: `user${i}@example.com`,
                name: `Test User ${i}`,
                age: 20 + (i % 40),
                metadata: {
                    company: companies[i % companies.length],
                    role: roles[i % roles.length]
                }
            });

            if (i % 100 === 0) {
                console.log(`Created ${i + 1} contacts...`);
            }
        }

        console.log('Test data generation completed!');
    } catch (error) {
        console.error('Error generating test data:', error);
    }
}

// Replace CommonJS check with ESM version
if (import.meta.url === `file://${process.argv[1]}`) {
    generateTestData().catch(console.error);
}

export { generateTestData };