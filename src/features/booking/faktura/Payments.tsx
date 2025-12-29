import React, { useMemo, useState } from "react";
import { ArrowDown, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../../AuthContext";
import useSales from "../../../hooks/useSales";

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

const getItemSummary = (sale: any) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (!items.length) return "";
  const names = items.map((item: any) => item.name).filter(Boolean);
  const summary = names.slice(0, 2).join(", ");
  if (names.length > 2) {
    return `${summary} +${names.length - 2}`;
  }
  return summary;
};

export default function Payments() {
  const { user } = useAuth();
  const { sales, loading, error } = useSales(user?.uid || null, {
    status: "completed",
  });
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale: any) => {
      const candidates = [
        getSaleNumber(sale),
        sale.customerName || "",
        sale.customerEmail || "",
        sale.employeeName || "",
        sale.paymentMethod || "",
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
          <h1 className="text-2xl font-semibold text-slate-900">
            Betalingstransaktioner
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Se, filtrer og eksport\u00e9r din betalingshistorik.
          </p>
        </div>
        <button type="button" className="toolbar-pill">
          Muligheder
          <ChevronDown className="toolbar-caret" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full bg-slate-50 px-2 py-2">
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
              nov. 22, 2025 - dec. 22, 2025
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              Filtre
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Betalingsdato
                      <ArrowDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Placering</th>
                  <th className="px-4 py-3 text-left">Ref nr</th>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="px-4 py-3 text-left">Medarbejder</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Metode</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-600">
                  <td className="px-4 py-3 font-semibold">I alt</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>

                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Henter betalinger...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Kunne ikke hente betalinger lige nu.
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Ingen gennemf\u00f8rte betalinger endnu.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filteredSales.map((sale: any) => {
                    const dateLabel = formatDateTime(sale.completedAtDate || null);
                    const saleNumber = getSaleNumber(sale) || "\u2014";
                    const customerName = sale.customerName || sale.customerEmail || "\u2014";
                    const itemSummary = getItemSummary(sale);
                    const total = formatCurrency(sale.totals?.total ?? 0);
                    const location = sale.location || "\u2014";
                    const employeeName = sale.employeeName || "\u2014";
                    const paymentMethod = sale.paymentMethod || "\u2014";

                    return (
                      <tr key={sale.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{dateLabel}</td>
                        <td className="px-4 py-3 text-slate-700">{location}</td>
                        <td className="px-4 py-3 text-indigo-500">{saleNumber}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{customerName}</div>
                          {itemSummary && (
                            <div className="text-xs text-slate-400">
                              {itemSummary} \u2022 {total} kr.
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{employeeName}</td>
                        <td className="px-4 py-3 text-slate-700">Salg</td>
                        <td className="px-4 py-3 text-slate-700">{paymentMethod}</td>
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
    </div>
  );
}
