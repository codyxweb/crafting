import { z } from 'zod';
export const registerSchema = z.object({ name:z.string().min(2).max(100), email:z.email(), password:z.string().min(8).max(100) });
export const loginSchema = z.object({ email:z.email(), password:z.string().min(1) });
export const customOrderSchema = z.object({ name:z.string().min(2), email:z.email(), craftType:z.string().min(1), productType:z.string().min(1), description:z.string().min(10).max(5000), material:z.string().max(100).optional(), color:z.string().max(100).optional(), quantity:z.coerce.number().int().min(1).max(100), budget:z.coerce.number().int().nonnegative().optional(), deadline:z.string().optional(), location:z.string().max(200).optional(), instructions:z.string().max(3000).optional() });
