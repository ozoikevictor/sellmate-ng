"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, DataTable, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { supabase } from "@/lib/supabase";

type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  status: string;
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadInventory = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,category,stock,status")
      .eq("user_id", userId)
      .order("stock", { ascending: true });

    if (error) {
      setMessage(error.message);
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInventory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  return (
    <>
      <SectionTitle eyebrow="Stockroom" title="Inventory" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      <DataTable
        headers={["Item", "SKU", "Category", "Available", "Status", "Signal"]}
        rows={
          loading
            ? [["Loading inventory...", "", "", "", "", ""]]
            : products.length === 0
              ? [["No products yet.", "", "", "", "", ""]]
              : products.map((product) => [
                  <strong key={product.id} className="text-slate-950">{product.name}</strong>,
                  product.sku,
                  product.category,
                  product.stock,
                  <Badge key={product.status} tone={product.status === "Sold out" ? "red" : product.status === "Low stock" ? "amber" : "green"}>{product.status}</Badge>,
                  <Badge key={`${product.id}-signal`} tone={product.stock === 0 ? "red" : product.stock <= 5 ? "amber" : "green"}>{product.stock === 0 ? "Sold out" : product.stock <= 5 ? "Reorder" : "Healthy"}</Badge>,
                ])
        }
      />
    </>
  );
}
