// ─── Sample Data Seeding ─────────────────────────────────────────────────────
// Populates Firestore 'categories' and 'products' with realistic demo retail
// data so the app demos well out of the box.
//
// Idempotent: seeding only runs when BOTH collections are empty, so re-running
// never creates duplicates. Invoked from the admin-only "Load sample data"
// button on AdminDashboard (the app is already configured for client-side
// Firestore access, and the admin is the natural actor — no separate Admin
// SDK service-account setup is needed).
import {
  collection, getDocs, writeBatch, doc, serverTimestamp, limit, query,
} from 'firebase/firestore';
import { db } from '../../firebase';

// Category seeds — keyed so products can reference them before doc IDs exist.
const CATEGORIES: { key: string; name: string; description: string }[] = [
  { key: 'beverages', name: 'Beverages',   description: 'Drinks, juices and water' },
  { key: 'snacks',    name: 'Snacks',      description: 'Chips, biscuits and candy' },
  { key: 'grocery',   name: 'Grocery',     description: 'Pantry and cooking staples' },
  { key: 'household', name: 'Household',   description: 'Cleaning and home supplies' },
  { key: 'personal',  name: 'Personal Care', description: 'Hygiene and toiletries' },
];

// Product seeds — price in PHP, realistic barcodes, references a category key.
const PRODUCTS: {
  name: string; price: number; stock: number; barcode: string; category: string;
}[] = [
  { name: 'Mineral Water 500ml',     price: 15,   stock: 120, barcode: '4800001000017', category: 'beverages' },
  { name: 'Cola Soft Drink 1.5L',    price: 65,   stock: 48,  barcode: '4800001000024', category: 'beverages' },
  { name: 'Orange Juice 1L',         price: 89,   stock: 30,  barcode: '4800001000031', category: 'beverages' },
  { name: 'Instant Coffee 100g',     price: 145,  stock: 25,  barcode: '4800001000048', category: 'beverages' },
  { name: 'Iced Tea Powder 25g',     price: 12,   stock: 200, barcode: '4800001000055', category: 'beverages' },
  { name: 'Potato Chips 60g',        price: 35,   stock: 80,  barcode: '4800002000016', category: 'snacks' },
  { name: 'Chocolate Bar 40g',       price: 28,   stock: 4,   barcode: '4800002000023', category: 'snacks' },
  { name: 'Cream Crackers 200g',     price: 42,   stock: 60,  barcode: '4800002000030', category: 'snacks' },
  { name: 'Salted Peanuts 100g',     price: 25,   stock: 90,  barcode: '4800002000047', category: 'snacks' },
  { name: 'Gummy Candy Pack',        price: 18,   stock: 3,   barcode: '4800002000054', category: 'snacks' },
  { name: 'White Rice 5kg',          price: 320,  stock: 22,  barcode: '4800003000015', category: 'grocery' },
  { name: 'Cooking Oil 1L',          price: 110,  stock: 35,  barcode: '4800003000022', category: 'grocery' },
  { name: 'White Sugar 1kg',         price: 75,   stock: 40,  barcode: '4800003000039', category: 'grocery' },
  { name: 'Iodized Salt 500g',       price: 22,   stock: 70,  barcode: '4800003000046', category: 'grocery' },
  { name: 'Soy Sauce 385ml',         price: 38,   stock: 55,  barcode: '4800003000053', category: 'grocery' },
  { name: 'Canned Sardines 155g',    price: 32,   stock: 100, barcode: '4800003000060', category: 'grocery' },
  { name: 'Dishwashing Liquid 500ml',price: 68,   stock: 44,  barcode: '4800004000014', category: 'household' },
  { name: 'Laundry Detergent 1kg',   price: 155,  stock: 28,  barcode: '4800004000021', category: 'household' },
  { name: 'Bleach 1L',               price: 48,   stock: 5,   barcode: '4800004000038', category: 'household' },
  { name: 'Trash Bags 10s',          price: 55,   stock: 65,  barcode: '4800004000045', category: 'household' },
  { name: 'Bath Soap 90g',           price: 30,   stock: 110, barcode: '4800005000013', category: 'personal' },
  { name: 'Shampoo Sachet 12ml',     price: 8,    stock: 250, barcode: '4800005000020', category: 'personal' },
  { name: 'Toothpaste 150g',         price: 92,   stock: 38,  barcode: '4800005000037', category: 'personal' },
  { name: 'Toothbrush Soft',         price: 45,   stock: 60,  barcode: '4800005000044', category: 'personal' },
  { name: 'Facial Tissue 100s',      price: 52,   stock: 2,   barcode: '4800005000051', category: 'personal' },
];

export type SeedResult =
  | { seeded: true;  categories: number; products: number }
  | { seeded: false; reason: 'already-populated' };

// Returns true when a collection has at least one document.
async function hasDocs(name: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, name), limit(1)));
  return !snap.empty;
}

// Seeds categories + products, but only when BOTH collections are empty.
// Safe to call repeatedly — a no-op once data exists.
export async function seedSampleData(): Promise<SeedResult> {
  const [hasCats, hasProds] = await Promise.all([
    hasDocs('categories'),
    hasDocs('products'),
  ]);
  if (hasCats || hasProds) {
    return { seeded: false, reason: 'already-populated' };
  }

  const batch = writeBatch(db);

  // Pre-generate category doc refs so products can link to real IDs.
  const catIdByKey: Record<string, string> = {};
  CATEGORIES.forEach((c) => {
    const ref = doc(collection(db, 'categories'));
    catIdByKey[c.key] = ref.id;
    batch.set(ref, {
      name: c.name,
      description: c.description,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  PRODUCTS.forEach((p) => {
    const ref = doc(collection(db, 'products'));
    batch.set(ref, {
      name: p.name,
      price: p.price,
      stock: p.stock,
      barcode: p.barcode,
      categoryId: catIdByKey[p.category],
      description: '',
      imageUrl: '',
      imagePath: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return { seeded: true, categories: CATEGORIES.length, products: PRODUCTS.length };
}
