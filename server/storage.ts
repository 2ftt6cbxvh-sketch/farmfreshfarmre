import {
  users, categories, products, coupons, reviews, orders, settings,
} from "@shared/schema";
import type {
  User, InsertUser, Category, InsertCategory, Product, InsertProduct,
  Coupon, InsertCoupon, Review, InsertReview, Order, InsertOrder,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

/* --------------------- Create tables if missing -------------------- */
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  diet_tag TEXT NOT NULL DEFAULT 'none',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL,
  price REAL NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '250 Grams',
  image TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 50,
  diet_tag TEXT NOT NULL DEFAULT 'none',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  discount_percent REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  min_order REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  coupon_code TEXT,
  payment_method TEXT NOT NULL DEFAULT 'COD',
  status TEXT NOT NULL DEFAULT 'Placed',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const now = () => Date.now();

export interface IStorage {
  // users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string }): Promise<User>;
  updateUserPassword(id: number, hash: string): Promise<void>;
  listUsers(): Promise<User[]>;
  // categories
  listCategories(): Promise<Category[]>;
  createCategory(c: InsertCategory): Promise<Category>;
  // products
  listProducts(opts?: { category?: string; q?: string; featured?: boolean }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(p: InsertProduct): Promise<Product>;
  updateProduct(id: number, p: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;
  // coupons
  listCoupons(): Promise<Coupon[]>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(c: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, c: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<void>;
  // reviews
  listReviews(productId: number): Promise<Review[]>;
  createReview(r: InsertReview): Promise<Review>;
  // orders
  listOrders(): Promise<Order[]>;
  listOrdersByUser(userId: number): Promise<Order[]>;
  createOrder(o: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  async getUserByEmail(email: string) { return db.select().from(users).where(eq(users.email, email)).get(); }
  async getUserByUsername(username: string) { return db.select().from(users).where(eq(users.username, username)).get(); }
  async createUser(u: InsertUser & { role?: string }) {
    return db.insert(users).values({ ...u, role: u.role || "customer", createdAt: now() }).returning().get();
  }
  async updateUserPassword(id: number, hash: string) {
    db.update(users).set({ password: hash }).where(eq(users.id, id)).run();
  }
  async listUsers() { return db.select().from(users).orderBy(desc(users.createdAt)).all(); }

  async listCategories() { return db.select().from(categories).orderBy(categories.sortOrder).all(); }
  async createCategory(c: InsertCategory) { return db.insert(categories).values(c).returning().get(); }

  async listProducts(opts?: { category?: string; q?: string; featured?: boolean }) {
    const conds = [];
    if (opts?.category) conds.push(eq(products.categorySlug, opts.category));
    if (opts?.featured) conds.push(eq(products.featured, true));
    if (opts?.q) conds.push(like(products.name, `%${opts.q}%`));
    let rows = conds.length
      ? db.select().from(products).where(and(...conds)).orderBy(desc(products.createdAt)).all()
      : db.select().from(products).orderBy(desc(products.createdAt)).all();
    return rows;
  }
  async getProduct(id: number) { return db.select().from(products).where(eq(products.id, id)).get(); }
  async createProduct(p: InsertProduct) { return db.insert(products).values({ ...p, createdAt: now() }).returning().get(); }
  async updateProduct(id: number, p: Partial<InsertProduct>) {
    return db.update(products).set(p).where(eq(products.id, id)).returning().get();
  }
  async deleteProduct(id: number) { db.delete(products).where(eq(products.id, id)).run(); }

  async listCoupons() { return db.select().from(coupons).orderBy(desc(coupons.createdAt)).all(); }
  async getCouponByCode(code: string) { return db.select().from(coupons).where(eq(coupons.code, code)).get(); }
  async createCoupon(c: InsertCoupon) { return db.insert(coupons).values({ ...c, createdAt: now() }).returning().get(); }
  async updateCoupon(id: number, c: Partial<InsertCoupon>) {
    return db.update(coupons).set(c).where(eq(coupons.id, id)).returning().get();
  }
  async deleteCoupon(id: number) { db.delete(coupons).where(eq(coupons.id, id)).run(); }

  async listReviews(productId: number) {
    return db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt)).all();
  }
  async createReview(r: InsertReview) { return db.insert(reviews).values({ ...r, createdAt: now() }).returning().get(); }

  async listOrders() { return db.select().from(orders).orderBy(desc(orders.createdAt)).all(); }
  async listOrdersByUser(userId: number) {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).all();
  }
  async createOrder(o: InsertOrder) { return db.insert(orders).values({ ...o, createdAt: now() }).returning().get(); }
  async updateOrderStatus(id: number, status: string) {
    return db.update(orders).set({ status }).where(eq(orders.id, id)).returning().get();
  }
}

export const storage = new DatabaseStorage();

/* ------------------------------ Seeding ----------------------------- */
const ADMIN_EMAIL = "admin@farmfreshfarmer.com";
const ADMIN_DEFAULT_PASSWORD = "admin((@%)$!(&*))"; // <-- change the default admin password here

const CATEGORY_SEED: { name: string; slug: string; dietTag: string }[] = [
  { name: "Fruits", slug: "fruits", dietTag: "veg" },
  { name: "Vegetables", slug: "vegetables", dietTag: "veg" },
  { name: "Homemade Sweets", slug: "homemade-sweets", dietTag: "veg" },
  { name: "Namkeen", slug: "namkeen", dietTag: "veg" },
  { name: "Pickles (Veg)", slug: "pickles-veg", dietTag: "veg" },
  { name: "Pickles (Non-Veg)", slug: "pickles-non-veg", dietTag: "nonveg" },
  { name: "Millets", slug: "millets", dietTag: "veg" },
  { name: "Pulses", slug: "pulses", dietTag: "veg" },
  { name: "Spices", slug: "spices", dietTag: "veg" },
  //{ name: "TestCategory", slug: "test-category", dietTag: "veg" },
];

interface SeedProduct {
  name: string; categorySlug: string; price: number; unit: string;
  description: string; image: string; dietTag: string; discountPercent?: number; featured?: boolean;
}

const PRODUCT_SEED: SeedProduct[] = [
  // Fruits
  { name: "Alphonso Mango", categorySlug: "fruits", price: 350, unit: "1 Kg", description: "Sweet, juicy Alphonso mangoes hand-picked at peak ripeness.", image: "/images/p-mango.jpg", dietTag: "veg", discountPercent: 10, featured: true },
  { name: "Bananas", categorySlug: "fruits", price: 60, unit: "1 Dozen", description: "Naturally ripened farm bananas, perfect for a healthy snack.", image: "/images/cat-fruits.jpg", dietTag: "veg" },
  { name: "Fresh Pomegranate", categorySlug: "fruits", price: 180, unit: "1 Kg", description: "Ruby-red, antioxidant-rich pomegranates.", image: "/images/cat-fruits.jpg", dietTag: "veg" },
  { name: "Seedless Grapes", categorySlug: "fruits", price: 90, unit: "500 Grams", description: "Crisp, sweet seedless grapes.", image: "/images/cat-fruits.jpg", dietTag: "veg" },

  // Vegetables
  { name: "Farm Tomatoes", categorySlug: "vegetables", price: 40, unit: "1 Kg", description: "Plump, vine-ripened tomatoes straight from the farm.", image: "/images/p-tomato.jpg", dietTag: "veg", featured: true },
  { name: "Green Spinach", categorySlug: "vegetables", price: 25, unit: "1 Bunch", description: "Fresh, leafy spinach packed with iron.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },
  { name: "Lady Finger (Okra)", categorySlug: "vegetables", price: 50, unit: "500 Grams", description: "Tender okra, hand-selected for quality.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },
  { name: "Fresh Carrots", categorySlug: "vegetables", price: 45, unit: "500 Grams", description: "Crunchy, sweet carrots.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },

  // Homemade Sweets
  { name: "Boondi Laddu", categorySlug: "homemade-sweets", price: 320, unit: "500 Grams", description: "Traditional ghee boondi laddus made fresh in small batches.", image: "/images/p-laddu.jpg", dietTag: "veg", discountPercent: 5, featured: true },
  { name: "Kaju Katli", categorySlug: "homemade-sweets", price: 650, unit: "500 Grams", description: "Premium cashew fudge with a delicate silver finish.", image: "/images/cat-sweets.jpg", dietTag: "veg" },
  { name: "Mysore Pak", categorySlug: "homemade-sweets", price: 380, unit: "500 Grams", description: "Rich, melt-in-mouth ghee Mysore pak.", image: "/images/cat-sweets.jpg", dietTag: "veg" },

  // Namkeen
  { name: "Special Mixture", categorySlug: "namkeen", price: 160, unit: "500 Grams", description: "Crunchy South-Indian style spicy mixture.", image: "/images/p-mixture.jpg", dietTag: "veg", featured: true },
  { name: "Murukku", categorySlug: "namkeen", price: 140, unit: "500 Grams", description: "Crispy, traditional rice-flour murukku.", image: "/images/cat-namkeen.jpg", dietTag: "veg" },
  { name: "Roasted Chana", categorySlug: "namkeen", price: 120, unit: "500 Grams", description: "Lightly spiced roasted chickpeas.", image: "/images/cat-namkeen.jpg", dietTag: "veg" },

  // Pickles Veg
  { name: "Mango Pickle (Avakaya)", categorySlug: "pickles-veg", price: 220, unit: "500 Grams", description: "Andhra-style spicy mango pickle in cold-pressed oil.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg", featured: true },
  { name: "Lemon Pickle", categorySlug: "pickles-veg", price: 180, unit: "500 Grams", description: "Tangy, sun-cured lemon pickle.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg" },
  { name: "Gongura Pickle", categorySlug: "pickles-veg", price: 200, unit: "500 Grams", description: "Classic Andhra gongura (sorrel leaf) pickle.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg" },

  // Pickles Non-Veg
  { name: "Chicken Pickle", categorySlug: "pickles-non-veg", price: 420, unit: "500 Grams", description: "Boneless chicken pickle in aromatic spices.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg", featured: true },
  { name: "Mutton Pickle", categorySlug: "pickles-non-veg", price: 520, unit: "500 Grams", description: "Tender mutton pickle, slow-cooked with spices.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg" },
  { name: "Prawn Pickle", categorySlug: "pickles-non-veg", price: 480, unit: "500 Grams", description: "Coastal-style prawn pickle.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg" },

  // Millets
  { name: "Foxtail Millet", categorySlug: "millets", price: 110, unit: "1 Kg", description: "Wholesome, high-fibre foxtail millet.", image: "/images/cat-millets.jpg", dietTag: "veg" },
  { name: "Pearl Millet (Bajra)", categorySlug: "millets", price: 90, unit: "1 Kg", description: "Nutritious bajra, perfect for rotis.", image: "/images/cat-millets.jpg", dietTag: "veg" },
  { name: "Finger Millet (Ragi)", categorySlug: "millets", price: 100, unit: "1 Kg", description: "Calcium-rich ragi flour grade grain.", image: "/images/cat-millets.jpg", dietTag: "veg" },

  // Pulses
  { name: "Toor Dal", categorySlug: "pulses", price: 150, unit: "1 Kg", description: "Premium unpolished toor dal.", image: "/images/cat-pulses.jpg", dietTag: "veg" },
  { name: "Moong Dal", categorySlug: "pulses", price: 140, unit: "1 Kg", description: "Split green gram, easy to cook.", image: "/images/cat-pulses.jpg", dietTag: "veg" },
  { name: "Chana Dal", categorySlug: "pulses", price: 130, unit: "1 Kg", description: "Protein-rich split chickpea lentils.", image: "/images/cat-pulses.jpg", dietTag: "veg" },

  // Spices
  { name: "Red Chilli Powder", categorySlug: "spices", price: 200, unit: "500 Grams", description: "Pure Guntur red chilli powder.", image: "/images/cat-spices.jpg", dietTag: "veg", featured: true },
  { name: "Turmeric Powder", categorySlug: "spices", price: 120, unit: "250 Grams", description: "Farm-fresh, high-curcumin turmeric.", image: "/images/cat-spices.jpg", dietTag: "veg" },
  { name: "Coriander Powder", categorySlug: "spices", price: 90, unit: "250 Grams", description: "Freshly ground coriander.", image: "/images/cat-spices.jpg", dietTag: "veg" },

  // Test Category
 /* { name: "Test Product 1", categorySlug: "test-category", price: 100, unit: "1 Kg", description: "This is a test product.", image: "/images/cat-fruits.jpg", dietTag: "veg" },
  { name: "Test Product 2", categorySlug: "test-category", price: 200, unit: "500 Grams", description: "This is another test product.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },*/
];
export async function seedDatabase() {
  // Categories
  const existingCats = db.select().from(categories).all();
  if (existingCats.length === 0) {
    CATEGORY_SEED.forEach((c, idx) => {
      db.insert(categories).values({ name: c.name, slug: c.slug, dietTag: c.dietTag, sortOrder: idx }).run();
    });
    console.log(`[seed] inserted ${CATEGORY_SEED.length} categories`);
  }

  // Products
  const existingProducts = db.select().from(products).all();
  if (existingProducts.length === 0) {
    PRODUCT_SEED.forEach((p) => {
      db.insert(products).values({
        name: p.name, description: p.description, categorySlug: p.categorySlug,
        price: p.price, discountPercent: p.discountPercent || 0, unit: p.unit,
        image: p.image, stock: 50, dietTag: p.dietTag, featured: !!p.featured, createdAt: now(),
      }).run();
    });
    console.log(`[seed] inserted ${PRODUCT_SEED.length} products`);
  }

  // Admin user
  const admin = db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).get();
  if (!admin) {
    const hash = bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10);
    db.insert(users).values({
      name: "Store Admin", email: ADMIN_EMAIL, username: "admin",
      password: hash, phone: null, address: null, role: "admin", createdAt: now(),
    }).run();
    console.log(`[seed] created admin user ${ADMIN_EMAIL}`);
  }

  // Sample coupon
  const existingCoupons = db.select().from(coupons).all();
  if (existingCoupons.length === 0) {
    db.insert(coupons).values({ code: "FRESH10", discountPercent: 10, active: true, minOrder: 0, createdAt: now() }).run();
    db.insert(coupons).values({ code: "ADMIN100", discountPercent: 100, active: true, minOrder: 0, createdAt: now() }).run();
    console.log(`[seed] created sample coupon FRESH10`);
  }
}

