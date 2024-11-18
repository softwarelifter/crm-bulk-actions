import { Request, Response } from 'express';
import { ContactService } from "../services/contact/contactService.js"
import { ContactSchema } from '../models/contact.js';

export class ContactController {
    private contactService = new ContactService()
    async create(req: Request, res: Response) {
        try {
            const validatedData = ContactSchema.parse(req.body);

            // Check for existing contact with same email
            const existing = await this.contactService.findByEmail(validatedData.email);
            if (existing) {
                return res.status(409).json({
                    error: 'Contact with this email already exists'
                });
            }

            const contact = await this.contactService.create(validatedData);
            res.status(201).json(contact);
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    async get(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }

            const contact = await this.contactService.findById(id);
            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            res.json(contact);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }

            // Validate partial data
            const validatedData = ContactSchema.partial().parse(req.body);

            // Check if contact exists
            const existing = await this.contactService.findById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Check email uniqueness if email is being updated
            if (validatedData.email && validatedData.email !== existing.email) {
                const emailExists = await this.contactService.findByEmail(validatedData.email);
                if (emailExists) {
                    return res.status(409).json({
                        error: 'Contact with this email already exists'
                    });
                }
            }

            const updated = await this.contactService.update(id, validatedData);
            res.json(updated);
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }

            const deleted = await this.contactService.delete(id);
            if (!deleted) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            if (page < 1 || limit < 1) {
                return res.status(400).json({ error: 'Invalid pagination parameters' });
            }

            const result = await this.contactService.list(page, limit);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

}