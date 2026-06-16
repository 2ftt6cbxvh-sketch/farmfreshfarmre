import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/change-password", { currentPassword: current, newPassword: next });
    },
    onSuccess: () => {
      setCurrent(""); setNext(""); setConfirm("");
      toast({ title: "Password changed", description: "Use your new password next time you log in." });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      toast({ title: "Could not change password", description: msg.includes("401") ? "Current password is incorrect." : "Please try again.", variant: "destructive" });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 4) return toast({ title: "Password too short", description: "Use at least 4 characters.", variant: "destructive" });
    if (next !== confirm) return toast({ title: "Passwords do not match", variant: "destructive" });
    change.mutate();
  }

  return (
    <AdminLayout title="Settings">
      <div className="max-w-md">
        <div className="rounded-xl border border-card-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-primary" />
            <h2 className="font-semibold">Change admin password</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Logged in as {user?.email}</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="cur">Current password</Label>
              <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required data-testid="input-current-password" />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required data-testid="input-new-password" />
            </div>
            <div>
              <Label htmlFor="conf">Confirm new password</Label>
              <Input id="conf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-confirm-password" />
            </div>
            <Button type="submit" disabled={change.isPending} data-testid="button-change-password">
              {change.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Tip: the default admin password is set in the code at <code className="bg-secondary px-1 rounded">server/storage.ts</code>.
          Changing it here updates it instantly without touching code.
        </p>
      </div>
    </AdminLayout>
  );
}
