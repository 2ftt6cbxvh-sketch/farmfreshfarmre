import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ----------------------------- Users ----------------------------- */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // username kept for template compatibility; we use email to log in
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  address: text("address"),
  role: text("role").notNull().default("customer"), // "customer" | "admin"
  createdAt: integer("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  role: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/* --------------------------- Categories --------------------------- */
// slug is the stable id used in navigation/URLs.
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // "none" | "veg" (green dot) | "nonveg" (red dot)
  dietTag: text("diet_tag").notNull().default("none"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

/* ---------------------------- Products ---------------------------- */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  categorySlug: text("category_slug").notNull(),
  price: real("price").notNull(), // base price in INR
  discountPercent: real("discount_percent").notNull().default(0), // 0-100
  unit: text("unit").notNull().default("250 Grams"),
  image: text("image").notNull().default(""), // URL or uploaded path
  stock: integer("stock").notNull().default(50),
  // "none" | "veg" | "nonveg" — overrides category default when set
  dietTag: text("diet_tag").notNull().default("none"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

/* ----------------------------- Coupons ---------------------------- */
export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  discountPercent: real("discount_percent").notNull(), // 0-100
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  minOrder: real("min_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
});
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

/* ----------------------------- Reviews ---------------------------- */
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

/* ----------------------------- Orders ----------------------------- */
// items stored as JSON text (SQLite has no array type)
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  itemsJson: text("items_json").notNull().default("[]"),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull(),
  couponCode: text("coupon_code"),
  paymentMethod: text("payment_method").notNull().default("COD"),
  status: text("status").notNull().default("Placed"), // Placed | Out for delivery | Delivered | Cancelled
  createdAt: integer("created_at").notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  status: true,
  createdAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

/* --------------------------- Site Settings ------------------------ */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export type Setting = typeof settings.$inferSelect;
