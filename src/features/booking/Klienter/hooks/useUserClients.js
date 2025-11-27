import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const mapDocToClient = (doc) => {
  const data = typeof doc.data === 'function' ? doc.data() : doc;

  const createdAtIso =
    (typeof data.createdAtIso === 'string' && data.createdAtIso) ||
    data.createdAt?.toDate?.()?.toISOString?.() ||
    null;

  return {
    id: doc.id || data.id,
    navn: data.navn || 'Uden navn',
    email: data.email || '',
    telefon: data.telefonKomplet || data.telefon || '',
    telefonLand: data.telefonLand || '+45',
    cpr: data.cpr || '',
    adresse: data.adresse || '',
    adresse2: data.adresse2 || '',
    postnummer: data.postnummer || '',
    by: data.by || '',
    land: data.land || 'Danmark',
    status: data.status || 'Aktiv',
    createdAt: createdAtIso,
  };
};

export function useUserClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }

    const clientsRef = collection(db, 'users', user.uid, 'clients');
    let unsubscribe = () => {};
    let fallbackSubscribed = false;

    const attachListener = (useOrderedQuery) => {
      const source = useOrderedQuery
        ? query(clientsRef, orderBy('createdAt', 'asc'))
        : clientsRef;

      unsubscribe = onSnapshot(
        source,
        (snapshot) => {
          const mapped = snapshot.docs.map((clientDoc) =>
            mapDocToClient(clientDoc)
          );
          setClients(mapped);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.error('[useUserClients] Error loading clients:', snapshotError);
          if (useOrderedQuery && !fallbackSubscribed) {
            fallbackSubscribed = true;
            unsubscribe();
            attachListener(false);
            return;
          }
          setClients([]);
          setError('Kunne ikke hente klienter. Prøv igen senere.');
          setLoading(false);
        }
      );
    };

    setLoading(true);
    setError(null);
    attachListener(true);

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  return { clients, loading, error };
}

export default useUserClients;

