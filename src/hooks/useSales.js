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

const mapSaleDoc = (doc) => {
  const data = doc.data() || {};
  const completedAtDate = resolveDate(data.completedAt);
  const createdAtDate = resolveDate(data.createdAt);
  const totals = data.totals || {
    subtotal: data.subtotal ?? 0,
    vat: data.vat ?? 0,
    total: data.total ?? 0,
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
    tips: typeof data.tips === "number" ? data.tips : 0,
  };
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
          ? mapped.filter((sale) => sale.status === status)
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
