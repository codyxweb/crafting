import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { error, forbidden, serverError } from '@/lib/http';

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams, q = p.get('q')?.trim(), page = Math.max(1, Number(p.get('page') || 1)), limit = Math.min(48, Math.max(1, Number(p.get('limit') || 12)));
    const category = p.get('category'), material = p.get('material'), color = p.get('color'), size = p.get('size');
    const min = p.has('minPrice') ? Number(p.get('minPrice')) : undefined, max = p.has('maxPrice') ? Number(p.get('maxPrice')) : undefined;
    const where: any = { published: true, ...(category ? { category: { slug: category } } : {}), ...(material ? { material: { contains: material, mode: 'insensitive' } } : {}), ...(color ? { color: { contains: color, mode: 'insensitive' } } : {}), ...(size ? { size: { contains: size, mode: 'insensitive' } } : {}), ...(min !== undefined || max !== undefined ? { price: { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) } } : {}) };
    if (q) where.OR = [...(['name','description','material'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) as any[]), { tags: { has: q } }, { category: { name: { contains: q, mode: 'insensitive' } } }];
    const orderBy = p.get('sort') === 'price-asc' ? { price: 'asc' as const } : p.get('sort') === 'price-desc' ? { price: 'desc' as const } : p.get('sort') === 'rating' ? { reviews: { _count: 'desc' as const } } : p.get('sort') === 'newest' ? { createdAt: 'desc' as const } : [{ featured: 'desc' as const }, { createdAt: 'desc' as const }];
    const [items,total] = await Promise.all([db.product.findMany({ where, include: { images: { orderBy: { position: 'asc' }, take: 1 }, category: true, inventory: true, _count: { select: { reviews: true } } }, orderBy: orderBy as any, skip: (page-1)*limit, take: limit }), db.product.count({ where })]);
    return NextResponse.json({ items, page, limit, total, pages: Math.ceil(total/limit) }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (cause) { return serverError(cause); }
}
const createSchema = z.object({ name: z.string().min(2), slug: z.string().regex(/^[a-z0-9-]+$/), description: z.string().min(1), price: z.number().int().nonnegative(), compareAtPrice: z.number().int().nonnegative().optional(), sku: z.string().min(1), categoryId: z.string().min(1), material: z.string().optional(), color: z.string().optional(), size: z.string().optional(), tags: z.array(z.string()).default([]), published: z.boolean().default(false), featured: z.boolean().default(false), stock: z.number().int().nonnegative().default(0), images: z.array(z.object({ url: z.string().url(), alt: z.string().optional() })).default([]) });
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return forbidden();
  try { const input = createSchema.safeParse(await request.json()); if (!input.success) return error('Check the product details and try again.'); const { stock, images, ...data } = input.data; const product = await db.product.create({ data: { ...data, inventory: { create: { quantity: stock } }, images: { create: images } }, include: { images: true, inventory: true } }); return NextResponse.json({ product }, { status: 201 }); }
  catch (cause) { return serverError(cause); }
}
