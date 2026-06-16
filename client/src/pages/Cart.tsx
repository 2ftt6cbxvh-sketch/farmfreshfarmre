import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingBag, Tag } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useCart, useAuth } from "@/lib/store";
import { formatINR } from "@/lib/types";
import { apiRequest, apiGet, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CouponResult {
  valid: boolean;
  code?: string;
  discountPercent?: number;
  message?: string;
}

export default function Cart() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");

  const discount = coupon ? Math.round(subtotal * (coupon.discountPercent / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;

  const applyCoupon = useMutation({
    mutationFn: () => apiGet<CouponResult>(`/api/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&subtotal=${subtotal}`),
    onSuccess: (res) => {
      if (res.valid && res.code && typeof res.discountPercent === "number") {
        setCoupon({ code: res.code, discountPercent: res.discountPercent });
        toast({ title: "Coupon applied", description: `${res.discountPercent}% off` });
      } else {
        setCoupon(null);
        toast({ title: "Invalid coupon", description: res.message || "This code can't be used.", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Invalid coupon", variant: "destructive" }),
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      const payload = {
        userId: user?.id ?? null,
        customerName: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: items.map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, price: i.price, qty: i.qty })),
        couponCode: coupon?.code ?? null,
        paymentMethod: "COD",
      };
      const res = await apiRequest("POST", "/api/orders", payload);
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (order) => {
      clear();
      toast({ title: "Order placed!", description: `Order #${order.id} — pay cash on delivery.` });
      navigate(user ? "/orders" : "/");
    },
    onError: () => toast({ title: "Could not place order", description: "Please try again.", variant: "destructive" }),
  });

  function handleCheckout() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast({ title: "Please fill all delivery details", variant: "destructive" });
      return;
    }
    placeOrder.mutate();
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <ShoppingBag className="mx-auto text-muted-foreground" size={48} />
          <h1 className="font-serif text-2xl font-bold mt-4">Your cart is empty</h1>
          <p className="text-muted-foreground mt-2">Add some fresh items to get started.</p>
          <Link href="/" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate" data-testid="link-continue-shopping">
            Continue shopping
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-6">Your cart</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((i) => (
              <div key={i.productId} className="flex gap-4 rounded-xl border border-card-border bg-card p-3" data-testid={`cart-item-${i.productId}`}>
                <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-secondary">
                  {i.image ? <img src={imgUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{i.name}</h3>
                  <p className="text-xs text-muted-foreground">{i.unit}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatINR(i.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => remove(i.productId)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove" data-testid={`button-remove-${i.productId}`}>
                    <Trash2 size={16} />
                  </button>
                  <div className="flex items-center rounded-md border border-input">
                    <button onClick={() => setQty(i.productId, i.qty - 1)} className="px-2 py-1 hover-elevate" aria-label="Decrease"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm" data-testid={`qty-${i.productId}`}>{i.qty}</span>
                    <button onClick={() => setQty(i.productId, i.qty + 1)} className="px-2 py-1 hover-elevate" aria-label="Increase"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary + checkout */}
          <div className="space-y-4">
            <div className="rounded-xl border border-card-border bg-card p-4">
              <h2 className="font-semibold mb-3">Order summary</h2>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  data-testid="input-coupon"
                />
                <Button variant="outline" onClick={() => applyCoupon.mutate()} disabled={!couponInput.trim() || applyCoupon.isPending} data-testid="button-apply-coupon">
                  <Tag size={14} className="mr-1" /> Apply
                </Button>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd data-testid="text-subtotal">{formatINR(subtotal)}</dd></div>
                {coupon && (
                  <div className="flex justify-between text-primary">
                    <dt>Coupon ({coupon.code})</dt><dd data-testid="text-discount">−{formatINR(discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="text-primary">Free</dd></div>
                <div className="flex justify-between border-t border-card-border pt-2 mt-2 font-bold text-base">
                  <dt>Total</dt><dd data-testid="text-total">{formatINR(total)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
              <h2 className="font-semibold">Delivery details</h2>
              <div>
                <Label htmlFor="ck-name" className="text-xs">Full name</Label>
                <Input id="ck-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div>
                <Label htmlFor="ck-phone" className="text-xs">Phone</Label>
                <Input id="ck-phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
              </div>
              <div>
                <Label htmlFor="ck-address" className="text-xs">Delivery address</Label>
                <Textarea id="ck-address" value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-address" />
              </div>
              <p className="text-xs text-muted-foreground">Payment: Cash on Delivery (COD)</p>
              <Button className="w-full" onClick={handleCheckout} disabled={placeOrder.isPending} data-testid="button-place-order">
                {placeOrder.isPending ? "Placing order…" : `Place order · ${formatINR(total)}`}
              </Button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  <Link href="/login" className="text-primary underline">Log in</Link> to track your orders.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
