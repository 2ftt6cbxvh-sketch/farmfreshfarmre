import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrderItem { name: string; unit: string; price: number; qty: number; }
const STATUSES = ["Placed", "Out for delivery", "Delivered", "Cancelled"];

export default function AdminOrders() {
  const { toast } = useToast();
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: () => apiGet<Order[]>("/api/orders"),
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/orders"] }); toast({ title: "Order updated" }); },
    onError: () => toast({ title: "Could not update", variant: "destructive" }),
  });

  return (
    <AdminLayout title="Orders">
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : orders.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card p-10 text-center text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            let items: OrderItem[] = [];
            try { items = JSON.parse(o.itemsJson); } catch { items = []; }
            return (
              <div key={o.id} className="rounded-xl border border-card-border bg-card p-4" data-testid={`admin-order-${o.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Order #{o.id}</span>
                      <Badge variant="secondary">{o.paymentMethod}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{o.customerName} · {o.phone}</p>
                    <p className="text-sm text-muted-foreground">{o.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatINR(o.total)}</p>
                    {o.discount > 0 && <p className="text-xs text-muted-foreground">Saved {formatINR(o.discount)}{o.couponCode ? ` (${o.couponCode})` : ""}</p>}
                    <div className="mt-2 w-44">
                      <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, status: v })}>
                        <SelectTrigger data-testid={`select-status-${o.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <ul className="mt-3 pt-3 border-t border-card-border text-sm text-muted-foreground space-y-0.5">
                  {items.map((it, idx) => <li key={idx}>{it.qty} × {it.name} ({it.unit}) — {formatINR(it.price * it.qty)}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
