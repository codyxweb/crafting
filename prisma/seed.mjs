import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
const categories=[{name:'Ceramics',slug:'ceramics'},{name:'Jewellery',slug:'jewellery'},{name:'Candles',slug:'candles'},{name:'Home & Living',slug:'home-living'}];
const items=[
 {name:'The Sunday Vase',slug:'the-sunday-vase',sku:'SY-CER-001',category:'ceramics',price:320000,material:'Stoneware',color:'Warm ivory',stock:12,image:'photo-1578500494198-246f612d3b3d'},
 {name:'Little Sun Studs',slug:'little-sun-studs',sku:'SY-JWL-001',category:'jewellery',price:185000,material:'Brass',color:'Gold',stock:18,image:'photo-1535632066927-ab7c9ab60908'},
 {name:'Still Life Candle',slug:'still-life-candle',sku:'SY-CAN-001',category:'candles',price:125000,material:'Soy wax',color:'Natural',stock:24,image:'photo-1603006905003-be475563bc59'},
 {name:'The Keepsake Bowl',slug:'the-keepsake-bowl',sku:'SY-CER-002',category:'ceramics',price:240000,material:'Stoneware',color:'Oat',stock:8,image:'photo-1578749556568-bc2c40e68b61'},
];
for(const c of categories)await db.category.upsert({where:{slug:c.slug},create:c,update:{name:c.name}});
for(const item of items){const category=await db.category.findUniqueOrThrow({where:{slug:item.category}});const {image,stock,category:_,...p}=item;await db.product.upsert({where:{slug:p.slug},create:{...p,description:`A thoughtful ${p.material.toLowerCase()} piece, made slowly by independent makers in India. Each one carries its own small variations and character.`,tags:['handmade','thoughtful gift'],published:true,featured:true,categoryId:category.id,images:{create:{url:`https://images.unsplash.com/${image}?auto=format&fit=crop&w=1000&q=85`,alt:p.name}},inventory:{create:{quantity:stock,lowStockThreshold:4}}},update:{name:p.name,price:p.price,published:true}});}
console.log('Seyora demo catalog is ready.');await db.$disconnect();
