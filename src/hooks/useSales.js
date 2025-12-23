import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

const resolveDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const normalizeNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "");
    if (!cleaned) return 0;
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");
    let normalized = cleaned;
    if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      normalized = cleaned.replace(",", ".");
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const mapSaleDoc = (doc) => {
  const data = doc.data() || {};
  const completedAtDate = resolveDate(data.completedAt);
  const createdAtDate = resolveDate(data.createdAt);
  const rawTotals = data.totals || {};
  const totals = {
    subtotal: normalizeNumber(
      rawTotals.subtotal ?? rawTotals.subTotal ?? data.subtotal ?? 0
    ),
    vat: normalizeNumber(rawTotals.vat ?? rawTotals.moms ?? data.vat ?? 0),
    total: normalizeNumber(rawTotals.total ?? data.total ?? 0),
  };

  return {
    id: doc.id,
    status: data.status || "pending",
    appointmentId: data.appointmentId || null,
    appointmentRef:
      data.appointmentRef ||
      data.appointmentReference ||
      data.appointmentRefNr ||
      data.appointmentRefNo ||
      data.reference ||
      data.referenceNumber ||
      null,
    customerId: data.customerId || null,
    customerName: data.customerName || data.customer || "",
    customerEmail: data.customerEmail || "",
    customerPhone: data.customerPhone || "",
    items: Array.isArray(data.items) ? data.items : [],
    totals,
    paymentMethod: data.paymentMethod || data.paymentType || "",
    employeeId: data.employeeId || null,
    employeeName: data.employeeName || data.employee || "",
    completedAt: data.completedAt || null,
    completedAtDate,
    createdAt: data.createdAt || null,
    createdAtDate,
    saleNumber:
      data.saleNumber || data.saleNo || data.saleRef || data.saleRefNo || null,
    location: data.location || "",
    tips: typeof data.tips === "number" ? data.tips : normalizeNumber(data.tips),
  };
};

const matchesStatus = (saleStatus, filterStatus) => {
  if (!filterStatus) return true;
  const normalizedSale = normalizeStatus(saleStatus);
  const normalizedFilter = normalizeStatus(filterStatus);
  if (!normalizedFilter) return true;
  if (normalizedFilter === "completed") {
    return ["completed", "gennemfort", "complete"].includes(normalizedSale);
  }
  return normalizedSale === normalizedFilter;
};

const useSales = (userId, options = {}) => {
  const { status } = options;
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setSales([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const salesRef = collection(db, "users", userId, "sales");
    const salesQuery = query(salesRef, orderBy("completedAt", "desc"));

    const unsubscribe = onSnapshot(
      salesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map(mapSaleDoc);
        const filtered = status
          ? mapped.filter((sale) => matchesStatus(sale.status, status))
          : mapped;
        setSales(filtered);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[useSales] snapshot error:", snapshotError);
        setError(snapshotError);
        setSales([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, status]);

  return { sales, loading, error };
};

export default useSales;
