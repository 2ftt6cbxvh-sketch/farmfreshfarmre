import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import session from "express-session";
import multer from "multer";
import bcrypt from "bcryptjs";
import { storage, seedDatabase } from "./storage";
import {
  insertProductSchema, insertCouponSchema, insertReviewSchema,
} from "@shared/schema";
import { z } from "zod";

// Session typing
declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function publicUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedDatabase();

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: "farmfreshfarmer-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 30 },
    })
  );

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    next();
  }
  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId || req.session.role !== "admin") return res.status(403).json({ message: "Admin only" });
    next();
  }

  /* ----------------------------- Auth ----------------------------- */
  app.post("/api/register", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(4),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid details" });
    const { name, email, password, phone } = parsed.data;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const hash = bcrypt.hashSync(password, 10);
    const user = await storage.createUser({
      name, email, username: email, password: hash, phone: phone || null, address: null,
    } as any);
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ user: publicUser(user) });
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });
    const user = await storage.getUserByEmail(String(email).toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Wrong email or password" });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ user: publicUser(user) });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await storage.getUser(req.session.userId);
    res.json({ user: user ? publicUser(user) : null });
  });

  /* --------------------------- Categories -------------------------- */
  app.get("/api/categories", async (_req, res) => {
    res.json(await storage.listCategories());
  });

  /* ---------------------------- Products --------------------------- */
  app.get("/api/products", async (req, res) => {
    const category = req.query.category ? String(req.query.category) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    const featured = req.query.featured === "1";
    res.json(await storage.listProducts({ category, q, featured }));
  });

  app.get("/api/products/:id", async (req, res) => {
    const p = await storage.getProduct(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid product", errors: parsed.error.flatten() });
    res.json(await storage.createProduct(parsed.data));
  });

  app.patch("/api/products/:id", requireAdmin, async (req, res) => {
    const parsed = insertProductSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid product" });
    const updated = await storage.updateProduct(Number(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ ok: true });
  });

  /* --------------------------- Image upload ------------------------ */
  // Stores the image as a base64 data URL so it works locally AND after deploy
  // (no dependency on a writable uploads folder).
  app.post("/api/upload", requireAdmin, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file" });
    const b64 = req.file.buffer.toString("base64");
    const url = `data:${req.file.mimetype};base64,${b64}`;
    res.json({ url });
  });

  /* ----------------------------- Reviews --------------------------- */
  app.get("/api/reviews", async (req, res) => {
    const productId = Number(req.query.productId);
    if (!productId) return res.json([]);
    res.json(await storage.listReviews(productId));
  });

  app.post("/api/reviews", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const body = {
      productId: Number(req.body.productId),
      userId: user.id,
      userName: user.name,
      rating: Math.max(1, Math.min(5, Number(req.body.rating) || 5)),
      comment: String(req.body.comment || ""),
    };
    const parsed = insertReviewSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid review" });
    res.json(await storage.createReview(parsed.data));
  });

  /* ----------------------------- Coupons --------------------------- */
  app.get("/api/coupons", requireAdmin, async (_req, res) => {
    res.json(await storage.listCoupons());
  });

  app.post("/api/coupons", requireAdmin, async (req, res) => {
    const parsed = insertCouponSchema.safeParse({ ...req.body, code: String(req.body.code || "").toUpperCase() });
    if (!parsed.success) return res.status(400).json({ message: "Invalid coupon" });
    const existing = await storage.getCouponByCode(parsed.data.code);
    if (existing) return res.status(409).json({ message: "Code exists" });
    res.json(await storage.createCoupon(parsed.data));
  });

  app.patch("/api/coupons/:id", requireAdmin, async (req, res) => {
    const parsed = insertCouponSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid coupon" });
    const updated = await storage.updateCoupon(Number(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/coupons/:id", requireAdmin, async (req, res) => {
    await storage.deleteCoupon(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/coupons/validate", async (req, res) => {
    const code = String(req.query.code || "").toUpperCase();
    const subtotal = Number(req.query.subtotal) || 0;
    const coupon = await storage.getCouponByCode(code);
    if (!coupon || !coupon.active) return res.json({ valid: false, message: "Invalid or inactive code" });
    if (subtotal < coupon.minOrder) {
      return res.json({ valid: false, message: `Minimum order ₹${coupon.minOrder} required` });
    }
    res.json({ valid: true, code: coupon.code, discountPercent: coupon.discountPercent });
  });

  /* ------------------------------ Orders --------------------------- */
  app.post("/api/orders", async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" });
    const subtotal = items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    let discount = 0;
    let couponCode: string | null = null;
    if (req.body.couponCode) {
      const coupon = await storage.getCouponByCode(String(req.body.couponCode).toUpperCase());
      if (coupon && coupon.active && subtotal >= coupon.minOrder) {
        discount = Math.round(subtotal * (coupon.discountPercent / 100) * 100) / 100;
        couponCode = coupon.code;
      }
    }
    const total = Math.round((subtotal - discount) * 100) / 100;
    const order = await storage.createOrder({
      userId: req.session.userId || null,
      customerName: String(req.body.customerName || ""),
      phone: String(req.body.phone || ""),
      address: String(req.body.address || ""),
      itemsJson: JSON.stringify(items),
      subtotal, discount, total,
      couponCode,
      paymentMethod: "COD",
    } as any);
    res.json({ id: order.id, total: order.total });
  });

  app.get("/api/orders/mine", requireAuth, async (req, res) => {
    res.json(await storage.listOrdersByUser(req.session.userId!));
  });

  app.get("/api/orders", requireAdmin, async (_req, res) => {
    res.json(await storage.listOrders());
  });

  app.patch("/api/orders/:id", requireAdmin, async (req, res) => {
    const status = String(req.body.status || "");
    const updated = await storage.updateOrderStatus(Number(req.params.id), status);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  /* ------------------------------ Users ---------------------------- */
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const users = await storage.listUsers();
    // never expose password hashes
    res.json(users.map((u) => ({ ...u, password: undefined })));
  });

  /* ----------------------- Admin: change password ------------------ */
  app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ message: "Password too short" });
    const admin = await storage.getUser(req.session.userId!);
    if (!admin || !bcrypt.compareSync(String(currentPassword || ""), admin.password)) {
      return res.status(401).json({ message: "Current password incorrect" });
    }
    await storage.updateUserPassword(admin.id, bcrypt.hashSync(String(newPassword), 10));
    res.json({ ok: true });
  });

  return httpServer;
}
