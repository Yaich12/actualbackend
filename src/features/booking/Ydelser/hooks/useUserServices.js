import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const mapDocToService = (doc) => {
  const data = doc.data ? doc.data() : doc;

  const createdAtTimestamp = data.createdAt;
  const createdAtIso =
    createdAtTimestamp?.toDate?.()?.toISOString?.() ??
    data.createdAtIso ??
    data.createdAt ??
    null;

  const price = typeof data.price === 'number' ? data.price : data.pris ?? 0;
  const priceInclVat =
    typeof data.priceInclVat === 'number'
      ? data.priceInclVat
      : data.prisInklMoms ?? price;

  return {
    id: doc.id || data.id,
    navn: data.name?.trim?.() || data.navn?.trim?.() || 'Ny ydelse',
    varighed: data.duration || data.varighed || '1 time',
    pris: price,
    prisInklMoms: priceInclVat,
    description: data.description || '',
    createdAt: createdAtIso,
    color: data.color || '#3B82F6',
  };
};

export function useUserServices() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setServices([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const servicesRef = collection(db, 'users', user.uid, 'services');
    const servicesQuery = query(servicesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      servicesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((doc) => mapDocToService(doc));
        setServices(mapped);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Error loading services:', snapshotError);
        setError('Kunne ikke hente dine ydelser.');
        setServices([]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  return { services, loading, error };
}

export default useUserServices;

