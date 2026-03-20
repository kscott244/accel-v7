"use client";

import type { Product } from "@/types";
import { fmtK } from "@/lib/utils";
import { MiniBarChart } from "@/components/charts/MiniBarChart";

interface ProductCardProps {
  product: Product;
  maxPY: number;
}

export function ProductCard({ product, maxPY }: ProductCardProps) {
  const retention = product.py > 0 ? (product.cy / product.py) * 100 : 0;

  return (
    <div className="card mb-2 p-3">
      <div className="mb-2 flex items-start justify-between">
        <div className="text-[12px] font-semibold text-t1">{product.name}</div>
        <div
          className="mono text-[11px] font-bold"
          style={{ color: product.growthPct >= 0 ? "var(--green)" : "var(--red)" }}
        >
          {product.growthPct >= 0 ? "+" : ""}
          {product.growthPct.toFixed(1)}%
        </div>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <div>
          <span className="text-[9px] text-t4">PY </span>
          <span className="mono text-[11px] font-semibold text-t3">{fmtK(product.py)}</span>
        </div>
        <div>
          <span className="text-[9px] text-accent-blue">CY </span>
          <span className="mono text-[11px] font-semibold text-t1">{fmtK(product.cy)}</span>
        </div>
        <div className="ml-auto">
          <span className="text-[9px] text-t4">Ret </span>
          <span className="mono text-[11px] font-semibold text-t3">{retention.toFixed(1)}%</span>
        </div>
      </div>

      <MiniBarChart pyValue={product.py} cyValue={product.cy} maxValue={maxPY} />
    </div>
  );
}
