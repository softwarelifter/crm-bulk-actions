import { pgPool } from "../../config/database.js";
import { Contact, CreateContactDTO, UpdateContactDTO } from "../../models/contact.js";

export class ContactService {
    async create(data: CreateContactDTO): Promise<Contact> {
        const result = await pgPool.query(
            `INSERT INTO contacts (email, name, age, metadata) 
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                data.email,
                data.name,
                data.age || null,
                data.metadata || {}
            ]
        );

        return result.rows[0];
    }

    async findById(
        id: number
    ): Promise<Contact | null> {
        const result = await pgPool.query(`SELECT * FROM contacts WHERE id=${id}`)
        return result.rows[0] || null
    }

    async findByEmail(email: string): Promise<Contact | null> {
        const result = await pgPool.query(
            'SELECT * FROM contacts WHERE email = $1',
            [email]
        );
        return result.rows[0] || null;
    }

    async update(
        id: number, data: UpdateContactDTO
    ): Promise<Contact | null> {
        const updates: string[] = []
        const values: any[] = []
        let paramCount = 1
        if (data.email !== undefined) {
            updates.push(`email = $${paramCount}`);
            values.push(data.email);
            paramCount++;
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramCount}`);
            values.push(data.name);
            paramCount++;
        }
        if (data.age !== undefined) {
            updates.push(`age = $${paramCount}`);
            values.push(data.age);
            paramCount++;
        }
        if (data.metadata !== undefined) {
            updates.push(`metadata = $${paramCount}`);
            values.push(data.metadata);
            paramCount++;
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        if (updates.length === 0) return this.findById(id);
        values.push(id);
        const result = await pgPool.query(
            `UPDATE contacts 
                SET ${updates.join(', ')} 
                WHERE id = $${paramCount}
                RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    async delete(id: number): Promise<boolean> {
        const result = await pgPool.query(
            'DELETE FROM contacts WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount ? result.rowCount > 0 : false;
    }

    async list(page: number = 1, limit: number = 10): Promise<{
        contacts: Contact[]
        total: number
        page: number
        totalPages: number
    }> {
        const offset = (page - 1) * limit

        const [countResult, dataResult] = await Promise.all([
            pgPool.query("SELECT COUNT(*) FROM contacts"),
            pgPool.query("SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                [limit, offset]
            )
        ])
        const total = parseInt(countResult.rows[0].count)
        const totalPages = Math.ceil(total / limit)
        return {
            contacts: dataResult.rows,
            total,
            totalPages,
            page
        }
    }

    async getTotalCount(filters?: Record<string, any>): Promise<number> {
        let query = 'SELECT COUNT(*) FROM contacts';
        const values: any[] = [];
        let paramCount = 1;

        if (filters && Object.keys(filters).length > 0) {
            const filterConditions: string[] = [];

            for (const [key, value] of Object.entries(filters)) {
                if (key.startsWith('metadata.')) {
                    // Handle metadata field filters
                    const metadataKey = key.split('.')[1];
                    filterConditions.push(`metadata->>'${metadataKey}' = $${paramCount}`);
                } else {
                    // Handle regular field filters
                    filterConditions.push(`${key} = $${paramCount}`);
                }
                values.push(value);
                paramCount++;
            }

            if (filterConditions.length > 0) {
                query += ` WHERE ${filterConditions.join(' AND ')}`;
            }
        }

        const result = await pgPool.query(query, values);
        return parseInt(result.rows[0].count);
    }

    async getBatch(
        offset: number,
        limit: number,
        filters?: Record<string, any>
    ): Promise<Contact[]> {
        let query = 'SELECT * FROM contacts';
        const values: any[] = [];
        let paramCount = 1;

        if (filters && Object.keys(filters).length > 0) {
            const filterConditions: string[] = [];

            for (const [key, value] of Object.entries(filters)) {
                if (key.startsWith('metadata.')) {
                    // Handle metadata field filters
                    const metadataKey = key.split('.')[1];
                    filterConditions.push(`metadata->>'${metadataKey}' = $${paramCount}`);
                } else {
                    // Handle regular field filters
                    filterConditions.push(`${key} = $${paramCount}`);
                }
                values.push(value);
                paramCount++;
            }

            if (filterConditions.length > 0) {
                query += ` WHERE ${filterConditions.join(' AND ')}`;
            }
        }

        // Add pagination
        query += ` ORDER BY id LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await pgPool.query(query, values);
        return result.rows;
    }

}