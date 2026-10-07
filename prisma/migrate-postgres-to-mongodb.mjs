import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const sourceSchemaPath = path.join(root, 'prisma', `.postgres-source-${randomUUID()}.prisma`);
const sourceClientPath = path.join(root, 'node_modules', '.prisma', 'postgres-source-client', 'index.js');
const models = [
  'user', 'address', 'category', 'product', 'productVariant', 'productImage',
  'inventory', 'cart', 'cartItem', 'wishlist', 'order', 'orderItem', 'payment',
  'coupon', 'review', 'customOrder', 'customOrderFile', 'quote', 'blogCategory',
  'blogPost', 'galleryItem', 'notification', 'shipping', 'siteSettings',
];
const batchSize = 100;

if (!process.env.DATABASE_URL?.startsWith('mongodb')) {
  throw new Error('Set DATABASE_URL to the MongoDB Atlas connection string before migrating.');
}
if (!process.env.POSTGRES_SOURCE_URL?.startsWith('postgres')) {
  throw new Error('Set POSTGRES_SOURCE_URL to the source PostgreSQL connection string before migrating.');
}

const destination = new PrismaClient();
let source;

try {
  const mongoSchema = await readFile(schemaPath, 'utf8');
  const postgresSchema = mongoSchema
    .replace('provider = "mongodb"', 'provider = "postgresql"')
    .replace('url      = env("DATABASE_URL")', 'url      = env("POSTGRES_SOURCE_URL")')
    .replaceAll(' @map("_id")', '')
    .replace(
      'provider = "prisma-client-js"',
      'provider = "prisma-client-js"\n  output   = "../node_modules/.prisma/postgres-source-client"',
    );
  await writeFile(sourceSchemaPath, postgresSchema);

  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  const generated = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', sourceSchemaPath], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (generated.error) throw generated.error;
  if (generated.status !== 0) throw new Error('Could not generate the temporary PostgreSQL client.');

  const require = createRequire(import.meta.url);
  const { PrismaClient: SourcePrismaClient } = require(sourceClientPath);
  source = new SourcePrismaClient();
  await Promise.all([source.$connect(), destination.$connect()]);

  for (const model of models) {
    const sourceDelegate = source[model];
    const destinationDelegate = destination[model];
    const primaryField = model === 'siteSettings' ? 'key' : 'id';
    const total = await sourceDelegate.count();
    let copied = 0;

    while (copied < total) {
      const rows = await sourceDelegate.findMany({
        orderBy: { [primaryField]: 'asc' },
        skip: copied,
        take: batchSize,
      });
      await Promise.all(rows.map((row) => destinationDelegate.upsert({
        where: { [primaryField]: row[primaryField] },
        create: row,
        update: row,
      })));
      copied += rows.length;
    }

    console.log(`${model}: copied ${copied} of ${total}`);
  }

  console.log('PostgreSQL data is now copied to MongoDB. The PostgreSQL database was not modified.');
} finally {
  if (source) await source.$disconnect();
  await destination.$disconnect();
  await unlink(sourceSchemaPath).catch((cause) => {
    if (cause.code !== 'ENOENT') throw cause;
  });
}
