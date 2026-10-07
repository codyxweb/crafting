import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { error, serverError, unauthorized } from '@/lib/http';

const body = z.object({
  addressId: z.string(),
  paymentMethod: z.enum(['COD', 'RAZORPAY']),
  notes: z.string().max(500).optional(),
});

const cartInclude = {
  items: {
    include: {
      product: { include: { inventory: true } },
      variant: true,
    },
  },
} satisfies Prisma.CartInclude;

type CheckoutCart = NonNullable<Awaited<ReturnType<typeof loadCart>>>;
type CheckoutItem = CheckoutCart['items'][number];

async function loadCart(userId: string) {
  return db.cart.findUnique({ where: { userId }, include: cartInclude });
}

async function restoreInventory(items: CheckoutItem[]) {
  for (const item of items) {
    if (item.variantId) {
      await db.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await db.inventory.updateMany({
        where: { productId: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
  }
}

async function restoreCart(userId: string, items: CheckoutItem[]) {
  let cart = await db.cart.findUnique({ where: { userId } });
  if (!cart) {
    try {
      cart = await db.cart.create({ data: { userId } });
    } catch (cause) {
      if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== 'P2002') throw cause;
      cart = await db.cart.findUnique({ where: { userId } });
      if (!cart) throw cause;
    }
  }

  for (const item of items) {
    const existing = await db.cartItem.findFirst({
      where: { cartId: cart.id, productId: item.productId, variantId: item.variantId },
    });
    const data = {
      quantity: item.quantity,
      customization: item.customization ?? undefined,
    };
    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: item.quantity }, customization: data.customization },
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          ...data,
        },
      });
    }
  }
}

async function removeIncompleteOrder(orderId: string) {
  await db.shipping.deleteMany({ where: { orderId } });
  await db.payment.deleteMany({ where: { orderId } });
  await db.orderItem.deleteMany({ where: { orderId } });
  await db.order.deleteMany({ where: { id: orderId } });
}

async function reserveStock(items: CheckoutItem[]) {
  const reserved: CheckoutItem[] = [];
  for (const item of items) {
    const result = item.variantId
      ? await db.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
      : await db.inventory.updateMany({
          where: { productId: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });

    if (!result.count) {
      await restoreInventory(reserved);
      throw new Error('OUT_OF_STOCK');
    }
    reserved.push(item);
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const input = body.safeParse(await request.json());
    if (!input.success) return error('Choose a delivery address and payment method.');
    if (input.data.paymentMethod === 'RAZORPAY' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
      return error('Online payment is temporarily unavailable. Please choose cash on delivery.', 503);
    }

    const address = await db.address.findFirst({ where: { id: input.data.addressId, userId: user.id } });
    if (!address) return error('Choose one of your saved delivery addresses.');

    const cart = await loadCart(user.id);
    if (!cart?.items.length) return error('Your bag is empty.');

    const items = cart.items;
    const subtotal = items.reduce((total, item) => total + (item.variant?.price ?? item.product.price) * item.quantity, 0);
    const shippingCost = subtotal >= 250000 ? 0 : 15000;
    const total = subtotal + shippingCost;
    const number = `SEY-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 5).toUpperCase()}`;

    await reserveStock(items);

    let orderId: string | undefined;
    try {
      const order = await db.order.create({
        data: {
          number,
          userId: user.id,
          addressId: address.id,
          status: 'PENDING',
          subtotal,
          discount: 0,
          tax: 0,
          shippingCost,
          total,
        },
      });
      orderId = order.id;

      for (const item of items) {
        await db.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            variantId: item.variantId ?? undefined,
            name: item.product.name,
            sku: item.variant?.sku ?? item.product.sku,
            unitPrice: item.variant?.price ?? item.product.price,
            quantity: item.quantity,
            customization: item.customization ?? undefined,
          },
        });
      }

      await db.payment.create({
        data: {
          orderId: order.id,
          provider: input.data.paymentMethod,
          amount: total,
          currency: 'INR',
          status: 'PENDING',
        },
      });
      await db.cartItem.deleteMany({ where: { cartId: cart.id } });
    } catch (cause) {
      try {
        if (orderId) await removeIncompleteOrder(orderId);
      } finally {
        await restoreInventory(items);
      }
      throw cause;
    }

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payment: true },
    });

    if (input.data.paymentMethod === 'RAZORPAY') {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: total, currency: 'INR', receipt: order.number, notes: { orderId: order.id } }),
      });

      if (!response.ok) {
        await restoreInventory(items);
        await restoreCart(user.id, items);
        await db.payment.update({ where: { orderId: order.id }, data: { status: 'FAILED' } });
        await db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        return error('Payment could not be started. Your bag has been restored.', 502);
      }

      const remote = await response.json();
      await db.payment.update({ where: { orderId: order.id }, data: { providerOrderId: remote.id } });
      return NextResponse.json({
        order,
        razorpay: { keyId: process.env.RAZORPAY_KEY_ID, orderId: remote.id, amount: total, currency: 'INR' },
      }, { status: 201 });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'OUT_OF_STOCK') {
      return error('A product in your bag no longer has enough stock. Please refresh your bag.', 409);
    }
    return serverError(cause);
  }
}
