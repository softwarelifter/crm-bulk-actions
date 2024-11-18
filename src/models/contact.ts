import { z } from 'zod'

export const ContactSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    age: z.number().min(0).optional(),
    metadata: z.record(z.string(), z.any()).optional()
})

export type Contact = z.infer<typeof ContactSchema> & {
    id: number
    created_at: Date
    updated_at: Date
}

export type CreateContactDTO = z.infer<typeof ContactSchema>
export type UpdateContactDTO = Partial<CreateContactDTO>
