import React, { useEffect, useMemo, useState } from 'react';
import '../bookingpage.css';
import './product.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
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
import { ChevronDown, Search } from 'lucide-react';

const DEFAULT_FORM_VALUES = {
  name: '',
  sku: '',
  brand: '',
  unit: 'ml',
  amount: '',
  shortDescription: '',
  description: '',
  category: '',
  price: '',
  costPrice: '',
  currency: 'DKK',
};

const UNIT_OPTIONS = [
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'stk', label: 'Stk.' },
  { value: 'pakke', label: 'Pakke' },
];

const CURRENCY_OPTIONS = ['DKK', 'EUR', 'USD'];

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
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
  const { user } = useAuth();
  const { t } = useLanguage();
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialProduct) {
      setFormValues({
        name: initialProduct.name || '',
        sku: initialProduct.sku || '',
        brand: initialProduct.brand || '',
        unit: initialProduct.unit || 'ml',
        amount: initialProduct.amount ?? '',
        shortDescription: initialProduct.shortDescription || '',
        description: initialProduct.description || '',
        category: initialProduct.category || '',
        price: initialProduct.price ?? '',
        costPrice: initialProduct.costPrice ?? '',
        currency: initialProduct.currency || 'DKK',
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

    if (!user?.uid) {
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
      const costValue = parseNumber(formValues.costPrice);
      const amountValue = parseNumber(formValues.amount);

      const payload = {
        name: formValues.name.trim(),
        sku: formValues.sku.trim() || null,
        brand: formValues.brand.trim() || null,
        unit: formValues.unit || null,
        amount: amountValue ?? null,
        shortDescription: formValues.shortDescription.trim() || null,
        description: formValues.description.trim() || null,
        category: formValues.category.trim() || null,
        price: priceValue ?? 0,
        costPrice: costValue ?? 0,
        currency: formValues.currency || 'DKK',
        updatedAt: serverTimestamp(),
      };

      if (mode === 'edit' && initialProduct?.id) {
        const productRef = doc(db, 'users', user.uid, 'products', initialProduct.id);
        await updateDoc(productRef, payload);
      } else {
        const productCollection = collection(db, 'users', user.uid, 'products');
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
          <div className="product-form-body">
            <div className="product-form-section">
              <h3>{t('booking.products.editor.sections.basic', 'Grundlæggende oplysninger')}</h3>
              <div className="product-form-grid">
                <div className="product-field full-width">
                  <label>{t('booking.products.editor.fields.name', 'Produktnavn')}</label>
                  <input
                    type="text"
                    value={formValues.name}
                    onChange={handleChange('name')}
                    placeholder={t('booking.products.editor.placeholders.name', 'F.eks. Recovery Shampoo')}
                  />
                </div>
                <div className="product-field">
                  <label>
                    {t('booking.products.editor.fields.sku', 'Produktstregkode')}
                    <span className="product-field-hint">
                      {t('booking.products.editor.optional', '(Valgfrit)')}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formValues.sku}
                    onChange={handleChange('sku')}
                    placeholder="UPC, EAN, GTIN"
                  />
                </div>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.brand', 'Produktmærke')}</label>
                  <input
                    type="text"
                    value={formValues.brand}
                    onChange={handleChange('brand')}
                    placeholder={t('booking.products.editor.placeholders.brand', 'Vælg et mærke')}
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
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.amount', 'Beløb')}</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.amount}
                    onChange={handleChange('amount')}
                    placeholder="0.00"
                  />
                </div>
                <div className="product-field full-width">
                  <div className="product-field-meta">
                    <label>{t('booking.products.editor.fields.shortDescription', 'Kort beskrivelse')}</label>
                    <span className="product-field-counter">
                      {formValues.shortDescription.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={formValues.shortDescription}
                    onChange={handleChange('shortDescription')}
                    placeholder={t('booking.products.editor.placeholders.shortDescription', 'Kort summary af produktet')}
                  />
                </div>
                <div className="product-field full-width">
                  <div className="product-field-meta">
                    <label>{t('booking.products.editor.fields.description', 'Produktbeskrivelse')}</label>
                    <span className="product-field-counter">
                      {formValues.description.length}/1000
                    </span>
                  </div>
                  <textarea
                    rows="4"
                    maxLength={1000}
                    value={formValues.description}
                    onChange={handleChange('description')}
                    placeholder={t(
                      'booking.products.editor.placeholders.description',
                      'Beskriv hvad produktet bruges til, ingredienser, effekter osv.'
                    )}
                  />
                </div>
                <div className="product-field full-width">
                  <label>{t('booking.products.editor.fields.category', 'Produktkategori')}</label>
                  <input
                    type="text"
                    value={formValues.category}
                    onChange={handleChange('category')}
                    placeholder={t('booking.products.editor.placeholders.category', 'Vælg en kategori')}
                  />
                </div>
              </div>
            </div>

            <div className="product-form-aside">
              <div className="product-photo-card">
                <h4>{t('booking.products.editor.sections.photo', 'Produktfotografier')}</h4>
                <p>{t('booking.products.editor.photoHint', 'Træk og slip et foto for at ændre rækkefølgen.')}</p>
                <div className="product-photo-placeholder">
                  <span>+</span>
                  <span>{t('booking.products.editor.photoCta', 'Tilføj et foto')}</span>
                </div>
              </div>
              <div className="product-form-section compact">
                <h3>{t('booking.products.editor.sections.pricing', 'Priser')}</h3>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.costPrice', 'Indkøbspris')}</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.costPrice}
                    onChange={handleChange('costPrice')}
                    placeholder="0.00"
                  />
                </div>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.salePrice', 'Salgspris')}</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.price}
                    onChange={handleChange('price')}
                    placeholder="0.00"
                  />
                </div>
                <div className="product-field">
                  <label>{t('booking.products.editor.fields.currency', 'Valuta')}</label>
                  <select value={formValues.currency} onChange={handleChange('currency')}>
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [showLearnMore, setShowLearnMore] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setProducts([]);
      setLoading(false);
      setLoadError('');
      return undefined;
    }

    setLoading(true);
    setLoadError('');
    const productsRef = collection(db, 'users', user.uid, 'products');
    const productsQuery = query(productsRef, orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        setProducts(snapshot.docs.map((docSnap) => mapDocToProduct(docSnap)));
        setLoading(false);
      },
      (error) => {
        console.error('[Product] load error', error);
        setLoadError(t('booking.products.errors.loadFailed', 'Kunne ikke hente produkter.'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t, user?.uid]);

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
    if (!user?.uid || !product?.id) return;
    const confirmed = window.confirm(
      t('booking.products.actions.confirmDelete', 'Slet produktet?')
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'products', product.id));
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
                    <button type="button" className="toolbar-pill toolbar-static">
                      {t('booking.products.list.actions.options', 'Muligheder')}
                      <ChevronDown className="toolbar-caret" />
                    </button>
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
                  <button type="button" className="toolbar-pill toolbar-static">
                    {t('booking.products.list.actions.filter', 'Filtre')}
                  </button>
                  <button type="button" className="product-sort">
                    {t('booking.products.list.actions.sort', 'Opdateret (nyeste først)')}
                    <ChevronDown />
                  </button>
                </div>

                <div className="product-table">
                  <div className="product-table-head">
                    <div className="product-cell checkbox">
                      <input type="checkbox" disabled />
                    </div>
                    <div className="product-cell">{t('booking.products.list.columns.name', 'Produktnavn')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.category', 'Kategori')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.amount', 'Mængde')}</div>
                    <div className="product-cell">{t('booking.products.list.columns.price', 'Salgspris')}</div>
                    <div className="product-cell actions">
                      {t('booking.products.list.columns.actions', 'Handlinger')}
                    </div>
                  </div>
                  <div className="product-table-body">
                    {filteredProducts.length === 0 ? (
                      <div className="product-empty-row">
                        {t('booking.products.list.emptyFiltered', 'Ingen produkter matcher din søgning.')}
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <div className="product-table-row" key={product.id}>
                          <div className="product-cell checkbox">
                            <input type="checkbox" />
                          </div>
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
