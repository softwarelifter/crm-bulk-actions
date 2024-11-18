// types/express/index.d.ts
import { Request } from 'express';

// Define the structure of your user object
interface User {
    accountId: string | number;
    // Add other user properties as needed
}

// Extend the Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export { };  // This is important to make the file a module