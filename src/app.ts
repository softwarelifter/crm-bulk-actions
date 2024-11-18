import express from 'express'
import dotenv from 'dotenv'
import bulkActionRoutes from "./routes/bulkAction.js"
import contactRoutes from "./routes/contact.js"
import authRoutes from './routes/auth.js';

dotenv.config()

const app = express()

app.use(express.json())
app.use("/bulk-actions", bulkActionRoutes)
app.use("/contacts", contactRoutes)
app.use('/auth', authRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});



const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`)
})
