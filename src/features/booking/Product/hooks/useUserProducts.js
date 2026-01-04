import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useAuth } from "../../../../AuthContext";

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
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setProducts([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const productsRef = collection(db, "users", user.uid, "products");
    const productsQuery = query(productsRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((docSnap) => mapDocToProduct(docSnap));
        setProducts(mapped);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error loading products:", snapshotError);
        setError("Kunne ikke hente produkter.");
        setProducts([]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  return { products, loading, error };
}

export default useUserProducts;
