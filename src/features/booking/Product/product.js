import React, { useEffect, useMemo, useState } from 'react';
import '../bookingpage.css';
import './product.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
import { migrateLegacyCollectionToClinic } from '../../../utils/workspaceContext';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { Search } from 'lucide-react';

const DEFAULT_FORM_VALUES = {
  name: '',
  category: '',
  unit: 'stk',
  amount: '',
  price: '',
};

const UNIT_OPTIONS = [
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'stk', label: 'Stk.' },
  { value: 'pakke', label: 'Pakke' },
];

const SORT_OPTIONS = [
  {
    value: 'updated_desc',
    labelKey: 'booking.products.list.actions.sortNewest',
    fallback: 'Opdateret (nyeste først)',
  },
  {
    value: 'updated_asc',
    labelKey: 'booking.products.list.actions.sortOldest',
    fallback: 'Opdateret (ældste først)',
  },
];

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  return 0;
};

const mapDocToProduct = (docSnap) => {
  const data = docSnap.data();
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt;
  return {
    id: docSnap.id,
    name: data.name || '',
    sku: data.sku || '',
    brand: data.brand || '',
    unit: data.unit || '',
    amount: data.amount ?? '',
    shortDescription: data.shortDescription || '',
    description: data.description || '',
    category: data.category || '',
    price: typeof data.price === 'number' ? data.price : Number(data.price) || 0,
    costPrice: typeof data.costPrice === 'number' ? data.costPrice : Number(data.costPrice) || 0,
    currency: data.currency || 'DKK',
    createdAt,
    updatedAt,
  };
};

function ProductEmptyState({ onStart }) {
  const { t } = useLanguage();

  return (
    <div className="product-empty">
      <div className="product-empty-content">
        <span className="product-pill">
          {t('booking.products.empty.badge', 'Gratis at bruge')}
        </span>
        <h1>
          {t(
            'booking.products.empty.title',
            'Administrer dit lager med Selma-produktlisten'
          )}
        </h1>
        <p className="product-empty-lead">
          {t(
            'booking.products.empty.subtitle',
            'Administrer dit lager og din lagerbeholdning, så du nemt kan bestille, spore og sælge:'
          )}
        </p>
        <ul className="product-empty-list">
          <li>
            <span className="product-check" aria-hidden="true" />
            {t(
              'booking.products.empty.featureOne',
              'Start med et enkelt produkt, eller importér mange på én gang'
            )}
          </li>
          <li>
            <span className="product-check" aria-hidden="true" />
            {t(
              'booking.products.empty.featureTwo',
              'Organisér din liste ved at tilføje mærker og kategorier'
            )}
          </li>
          <li>
            <span className="product-check" aria-hidden="true" />
            {t(
              'booking.products.empty.featureThree',
              'Hold mængden på det rette niveau med påmindelser ved lav lagerbeholdning'
            )}
          </li>
          <li>
            <span className="product-check" aria-hidden="true" />
            {t(
              'booking.products.empty.featureFour',
              'Sælg produkter online og ved betaling på salgssted'
            )}
          </li>
        </ul>
        <div className="product-empty-actions">
          <button type="button" className="product-cta" onClick={onStart}>
            {t('booking.products.empty.cta', 'Kom i gang nu')}
          </button>
          <button type="button" className="product-link">
            {t('booking.products.empty.learnMore', 'Læs mere')}
          </button>
        </div>
      </div>
      <div className="product-empty-visual" aria-hidden="true">
        <div className="product-empty-card card-main">
          <div className="product-empty-card-title">
            {t('booking.products.empty.cardTitle', 'Produkter')}
          </div>
          <div className="product-empty-card-grid">
            <div className="product-empty-card-item" />
            <div className="product-empty-card-item" />
            <div className="product-empty-card-item" />
            <div className="product-empty-card-item" />
          </div>
        </div>
        <div className="product-empty-card card-float" />
      </div>
    </div>
  );
}

function ProductEditor({ isOpen, mode, initialProduct, onClose, onSaved }) {
  const { workspaceUid, activeClinicId, user } = useAuth();
  const clinicId = `${activeClinicId || ''}`.trim();
  const { t } = useLanguage();
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialProduct) {
      setFormValues({
        name: initialProduct.name || '',
        category: initialProduct.category || '',
        unit: initialProduct.unit || 'stk',
        amount: initialProduct.amount ?? '',
        price: initialProduct.price ?? '',
      });
    } else {
      setFormValues(DEFAULT_FORM_VALUES);
    }
    setSaveError('');
    setIsSaving(false);
  }, [isOpen, mode, initialProduct]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (field) => (event) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    if (!clinicId && !workspaceUid) {
      setSaveError(
        t('booking.products.editor.errors.notLoggedIn', 'Log ind for at gemme et produkt.')
      );
      return;
    }

    if (!formValues.name.trim()) {
      setSaveError(
        t('booking.products.editor.errors.missingName', 'Angiv et produktnavn.')
      );
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      const priceValue = parseNumber(formValues.price);
      const amountValue = parseNumber(formValues.amount);

      const payload = {
        name: formValues.name.trim(),
        category: formValues.category.trim() || null,
        unit: formValues.unit || null,
        amount: amountValue ?? null,
        price: priceValue ?? 0,
        clinicId: clinicId || null,
        createdByUid: user?.uid || null,
        currency: 'DKK',
        updatedAt: serverTimestamp(),
      };

      if (mode === 'edit' && initialProduct?.id) {
        const productRef = clinicId
          ? doc(db, 'clinics', clinicId, 'products', initialProduct.id)
          : doc(db, 'users', workspaceUid, 'products', initialProduct.id);
        await updateDoc(productRef, payload);
      } else {
        const productCollection = clinicId
          ? collection(db, 'clinics', clinicId, 'products')
          : collection(db, 'users', workspaceUid, 'products');
        await addDoc(productCollection, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (error) {
      console.error('[Product] Failed to save', error);
      setSaveError(
        t('booking.products.editor.errors.saveFailed', 'Kunne ikke gemme produktet. Prøv igen.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="product-modal-overlay">
      <div className="product-modal">
        <div className="product-modal-header">
          <button type="button" className="product-modal-close" onClick={onClose}>
            ×
          </button>
          <h2 className="product-modal-title">
            {mode === 'edit'
              ? t('booking.products.editor.titleEdit', 'Rediger produkt')
              : t('booking.products.editor.titleCreate', 'Tilføj nyt produkt')}
          </h2>
          <button
            type="submit"
            form="product-editor-form"
            className="product-modal-save"
            disabled={isSaving}
          >
            {isSaving
              ? t('booking.products.editor.actions.saving', 'Gemmer...')
              : t('booking.products.editor.actions.save', 'Gem')}
          </button>
        </div>

        <form id="product-editor-form" className="product-form" onSubmit={handleSubmit}>
          <div className="product-form-body product-form-body-simple">
            <div className="product-form-section product-form-section-simple">
              <h3>{t('booking.products.editor.sections.basic', 'Grundlæggende oplysninger')}</h3>
              <div className="product-form-grid product-form-grid-simple">
                <div className="product-field full-width">
                  <label>{t('booking.products.editor.fields.name', 'Produktnavn')}</label>
                  <input
                    type="text"
                    value={formValues.name}
                    onChange={handleChange('name')}
                    placeholder={t('booking.products.editor.placeholders.name', 'F.eks. Recovery Shampoo')}
                  />
                </div>
                <div className="product-field full-width">
                  <label>
                    {t('booking.products.editor.fields.category', 'Produktkategori')}
                    <span className="product-field-hint">
                      {t('booking.products.editor.optional', '(Valgfrit)')}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formValues.category}
                    onChange={handleChange('category')}
                    placeholder={t('booking.products.editor.placeholders.category', 'Vælg en kategori')}
                  />
                </div>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.amount', 'Beløb')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formValues.amount}
                    onChange={handleChange('amount')}
                    placeholder="0"
                  />
                </div>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.unit', 'Mål')}</label>
                  <select value={formValues.unit} onChange={handleChange('unit')}>
                    {UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="product-field full-width">
                  <label>{t('booking.products.editor.fields.salePrice', 'Salgspris')} (DKK)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formValues.price}
                    onChange={handleChange('price')}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {saveError && <div className="product-form-error">{saveError}</div>}
        </form>
      </div>
    </div>
  );
}

function Product() {
  const { workspaceUid, activeClinicId, user } = useAuth();
  const clinicId = `${activeClinicId || ''}`.trim();
  const { t, locale } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [sortOrder, setSortOrder] = useState('updated_desc');

  useEffect(() => {
    if (!clinicId && !workspaceUid) {
      setProducts([]);
      setLoading(false);
      setLoadError('');
      return undefined;
    }

    setLoading(true);
    setLoadError('');
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
      if (clinicId && workspaceUid) {
        try {
          await migrateLegacyCollectionToClinic({
            clinicId,
            legacyOwnerUid: workspaceUid,
            collectionName: 'products',
            transformDoc: ({ data }) => ({
              clinicId,
              createdByUid: data.createdByUid || user?.uid || null,
            }),
          });
        } catch (migrationError) {
          console.error('[Product] migration error', migrationError);
        }
      }
      if (cancelled) return;
      const productsRef = clinicId
        ? collection(db, 'clinics', clinicId, 'products')
        : collection(db, 'users', workspaceUid, 'products');
      const productsQuery = query(productsRef, orderBy('updatedAt', 'desc'));
      const stop = onSnapshot(
        productsQuery,
        (snapshot) => {
          if (cancelled) return;
          setProducts(snapshot.docs.map((docSnap) => mapDocToProduct(docSnap)));
          setLoading(false);
        },
        (error) => {
          if (cancelled) return;
          console.error('[Product] load error', error);
          setLoadError(t('booking.products.errors.loadFailed', 'Kunne ikke hente produkter.'));
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
  }, [clinicId, t, user?.uid, workspaceUid]);

  const filteredProducts = useMemo(() => {
    const queryValue = searchQuery.trim().toLowerCase();
    if (!queryValue) return products;
    return products.filter((product) => {
      const fields = [product.name, product.sku, product.brand, product.category]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return fields.some((value) => value.includes(queryValue));
    });
  }, [products, searchQuery]);

  const sortedProducts = useMemo(() => {
    const nextProducts = [...filteredProducts];
    nextProducts.sort((productA, productB) => {
      const productATime =
        toTimestamp(productA.updatedAt) ||
        toTimestamp(productA.createdAt);
      const productBTime =
        toTimestamp(productB.updatedAt) ||
        toTimestamp(productB.createdAt);

      if (sortOrder === 'updated_asc') {
        return productATime - productBTime;
      }
      return productBTime - productATime;
    });
    return nextProducts;
  }, [filteredProducts, sortOrder]);

  const formatCurrency = (amount, currency) => {
    const value = Number(amount) || 0;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency || 'DKK'} ${formatted}`;
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditingProduct(null);
    setEditorOpen(true);
  };

  const openEdit = (product) => {
    setEditorMode('edit');
    setEditingProduct(product);
    setEditorOpen(true);
  };

  const openLearnMore = () => {
    setShowLearnMore(true);
  };

  const handleLearnMoreStart = () => {
    setShowLearnMore(false);
    openCreate();
  };

  const handleDelete = async (product) => {
    if ((!clinicId && !workspaceUid) || !product?.id) return;
    const confirmed = window.confirm(
      t('booking.products.actions.confirmDelete', 'Slet produktet?')
    );
    if (!confirmed) return;
    try {
      if (clinicId) {
        await deleteDoc(doc(db, 'clinics', clinicId, 'products', product.id));
      } else {
        await deleteDoc(doc(db, 'users', workspaceUid, 'products', product.id));
      }
    } catch (error) {
      console.error('[Product] delete error', error);
      alert(
        t('booking.products.errors.deleteFailed', 'Kunne ikke slette produktet. Prøv igen.')
      );
    }
  };

  const showEmptyState = !loading && !loadError && products.length === 0;
  const showLearnMoreState = !loading && !loadError && products.length > 0 && showLearnMore;

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          <div className="product-main">
            {loading && (
              <div className="product-status">
                {t('booking.products.loading', 'Henter produkter...')}
              </div>
            )}

            {loadError && <div className="product-status error">{loadError}</div>}

            {showEmptyState && (
              <ProductEmptyState onStart={openCreate} />
            )}

            {showLearnMoreState && (
              <ProductEmptyState onStart={handleLearnMoreStart} />
            )}

            {!loading && !loadError && products.length > 0 && !showLearnMoreState && (
              <>
                <div className="product-header">
                  <div>
                    <div className="product-header-title">
                      {t('booking.products.list.title', 'Produktliste')}
                      <span className="product-count">{products.length}</span>
                    </div>
                    <p className="product-header-subtitle">
                      {t(
                        'booking.products.list.subtitle',
                        'Tilføj og administrer dine produkter på lager.'
                      )}
                      {' '}
                      <button type="button" className="product-inline-link" onClick={openLearnMore}>
                        {t('booking.products.list.learnMore', 'Læs mere')}
                      </button>
                    </p>
                  </div>
                  <div className="product-header-actions">
                    <button type="button" className="toolbar-pill toolbar-primary" onClick={openCreate}>
                      {t('booking.products.list.actions.add', 'Tilføj')}
                    </button>
                  </div>
                </div>

                <div className="product-toolbar">
                  <div className="product-search">
                    <Search className="product-search-icon" />
                    <input
                      type="text"
                      placeholder={t(
                        'booking.products.list.searchPlaceholder',
                        'Søg efter produktnavn eller stregkode'
                      )}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="product-sort-wrap">
                    <select
                      className="product-sort-select"
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                      aria-label={t('booking.products.list.actions.sortLabel', 'Sorter produkter')}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey, option.fallback)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="product-table">
                  <div className="product-table-head">
                    <div className="product-cell">{t('booking.products.list.columns.name', 'Produktnavn')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.category', 'Kategori')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.amount', 'Mængde')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.price', 'Salgspris')}</div>
                    <div className="product-cell actions">
                      {t('booking.products.list.columns.actions', 'Handlinger')}
                    </div>
                  </div>
                  <div className="product-table-body">
                    {sortedProducts.length === 0 ? (
                      <div className="product-empty-row">
                        {t('booking.products.list.emptyFiltered', 'Ingen produkter matcher din søgning.')}
                      </div>
                    ) : (
                      sortedProducts.map((product) => (
                        <div className="product-table-row" key={product.id}>
                          <div className="product-cell name">
                            <div className="product-name">{product.name || t('booking.products.list.untitled', 'Uden navn')}</div>
                            <div className="product-meta">
                              {product.sku ? `SKU ${product.sku}` : 'SKU —'}
                            </div>
                          </div>
                          <div className="product-cell">
                            {product.category || product.brand || '—'}
                          </div>
                          <div className="product-cell">
                            {product.amount !== null &&
                            product.amount !== undefined &&
                            product.amount !== ''
                              ? `${product.amount} ${product.unit || ''}`.trim()
                              : '—'}
                          </div>
                          <div className="product-cell">
                            {formatCurrency(product.price, product.currency)}
                          </div>
                          <div className="product-cell actions">
                            <button
                              type="button"
                              className="product-action-btn"
                              onClick={() => openEdit(product)}
                            >
                              {t('booking.products.list.actions.edit', 'Rediger')}
                            </button>
                            <button
                              type="button"
                              className="product-action-btn danger"
                              onClick={() => handleDelete(product)}
                            >
                              {t('booking.products.list.actions.delete', 'Slet')}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ProductEditor
        isOpen={editorOpen}
        mode={editorMode}
        initialProduct={editingProduct}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setEditorOpen(false)}
      />
    </BookingSidebarLayout>
  );
}

export default Product;
