import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../../AuthContext";
import useSales from "../../../hooks/useSales";
import AddNowDrawer from "./AddNowDrawer";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDateTime = (date: Date | null) => {
  if (!date) return "";
  const day = date.getDate();
  const month = date.toLocaleString("da-DK", { month: "short" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

const getSaleNumber = (sale: any) => {
  const ref = sale?.saleNumber || sale?.appointmentRef || sale?.id || "";
  return ref ? String(ref).replace(/^#/, "") : "";
};

export default function Sales() {
  const { user } = useAuth();
  const { sales, loading, error } = useSales(user?.uid || null, {
    status: "completed",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale: any) => {
      const candidates = [
        getSaleNumber(sale),
        sale.customerName || "",
        sale.customerEmail || "",
      ];
      return candidates.some((value) =>
        String(value).toLowerCase().includes(query)
      );
    });
  }, [sales, searchTerm]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Salg</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vis, filtrer og eksport\u00e9r din salgshistorik. {" "}
            <a href="#" className="text-indigo-500">
              L\u00e6s mere
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="toolbar-pill">
            Muligheder
            <ChevronDown className="toolbar-caret" />
          </button>
          <button
            type="button"
            className="toolbar-pill toolbar-primary"
            onClick={() => setDrawerOpen(true)}
          >
            Tilf\u00f8j nu
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Salg
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Kladder
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-full bg-slate-50 px-2 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="S\u00f8g efter salg eller kunde"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              I dag
              <Calendar className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              Filtre
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            Sorter efter
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Salg nr.
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Kunde
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Salgsdato
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      Drikkepenge
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      Brutto i alt
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Henter salg...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Kunne ikke hente salg lige nu.
                    </td>
                  </tr>
                )}
                {!loading && !error && filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Ingen gennemf\u00f8rte salg endnu.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  filteredSales.map((sale: any) => {
                    const saleNumber = getSaleNumber(sale) || "\u2014";
                    const customer = sale.customerName || sale.customerEmail || "\u2014";
                    const saleDate = formatDateTime(sale.completedAtDate || null);
                    const tips = sale.tips || 0;
                    const total = sale.totals?.total ?? 0;
                    return (
                      <tr key={sale.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-indigo-500">
                          {saleNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{customer}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Gennemf\u00f8rt
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{saleDate}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(tips)} kr.
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(total)} kr.
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            Viser {filteredSales.length} af {sales.length} resultater
          </div>
        </div>
      </div>

      <AddNowDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
