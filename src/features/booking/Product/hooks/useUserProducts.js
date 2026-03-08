import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useAuth } from "../../../../AuthContext";
import { deriveLegacyOwnerUid, migrateLegacyCollectionToClinic } from "../../../../utils/workspaceContext";

const normalizeId = (value) => `${value || ""}`.trim();

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
};

const mapDocToProduct = (docSnap) => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const priceValue = parseNumber(data.price);
  const costValue = parseNumber(data.costPrice);
  const amountValue = parseNumber(data.amount);

  return {
    id: docSnap.id || data.id,
    name: data.name || data.navn || "Produkt",
    sku: data.sku || "",
    brand: data.brand || "",
    unit: data.unit || "",
    amount: amountValue,
    shortDescription: data.shortDescription || "",
    description: data.description || "",
    category: data.category || "",
    price: priceValue ?? 0,
    costPrice: costValue ?? 0,
    currency: data.currency || "DKK",
  };
};

export function useUserProducts() {
  const { workspaceUid, activeClinicId, userDoc, sessionUid } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const clinicId = normalizeId(activeClinicId || userDoc?.activeClinicId || userDoc?.clinicId || "");
  const legacyOwnerUid = deriveLegacyOwnerUid(userDoc, workspaceUid || sessionUid || "");

  useEffect(() => {
    if (!clinicId && !legacyOwnerUid) {
      setProducts([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    let cancelled = false;
    let unsubscribe = () => {};
    const setUnsubscribe = (nextUnsubscribe) => {
      let stopped = false;
      unsubscribe = () => {
        if (stopped) return;
        stopped = true;
        nextUnsubscribe();
      };
    };

    const attachListener = async () => {
      let productsRef = null;
      if (clinicId) {
        if (legacyOwnerUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid,
              collectionName: "products",
              transformDoc: ({ data }) => ({
                clinicId,
                createdByUid: data.createdByUid || data.ownerUid || sessionUid || null,
              }),
            });
          } catch (migrationError) {
            console.error("[useUserProducts] Legacy migration failed:", migrationError);
          }
        }
        if (cancelled) return;
        productsRef = collection(db, "clinics", clinicId, "products");
      } else {
        if (cancelled) return;
        productsRef = collection(db, "users", legacyOwnerUid, "products");
      }
      const productsQuery = query(productsRef, orderBy("updatedAt", "desc"));

      if (cancelled) return;
      const stop = onSnapshot(
        productsQuery,
        (snapshot) => {
          if (cancelled) return;
          const mapped = snapshot.docs.map((docSnap) => mapDocToProduct(docSnap));
          setProducts(mapped);
          setLoading(false);
        },
        (snapshotError) => {
          if (cancelled) return;
          console.error("Error loading products:", snapshotError);
          setError("Kunne ikke hente produkter.");
          setProducts([]);
          setLoading(false);
        }
      );
      if (cancelled) {
        stop();
        return;
      }
      setUnsubscribe(stop);
    };

    void attachListener();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clinicId, legacyOwnerUid, sessionUid]);

  return { products, loading, error };
}

export default useUserProducts;
