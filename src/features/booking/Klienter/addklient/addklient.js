import React, { useState } from 'react';
import './addklient.css';

function AddKlient({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    billede: null,
    navn: '',
    cpr: '',
    fødselsdato: '',
    email: '',
    telefon: '',
    telefonLand: '+45',
    adresse: '',
    adresse2: '',
    postnummer: '',
    by: '',
    region: '',
    land: 'Danmark',
    noter: '',
  });

  const [showAddressLine2, setShowAddressLine2] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        billede: file,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onSave === 'function') {
      onSave(formData);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="addklient-modal-overlay" onClick={handleCancel}>
      <div className="addklient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="addklient-modal-header">
          <h2 className="addklient-modal-title">Tilføj klient</h2>
          <button className="addklient-close-btn" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form className="addklient-form" onSubmit={handleSubmit}>
          {/* Image Upload */}
          <div className="addklient-form-section">
            <label className="addklient-form-label">Billede</label>
            <div className="addklient-image-upload">
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleImageChange}
                className="addklient-image-input"
              />
              <label htmlFor="image-upload" className="addklient-image-label">
                {formData.billede ? (
                  <div className="addklient-image-preview">
                    <img
                      src={URL.createObjectURL(formData.billede)}
                      alt="Preview"
                      className="addklient-preview-img"
                    />
                  </div>
                ) : (
                  <>
                    <span className="addklient-upload-icon">☁</span>
                    <span className="addklient-upload-text">
                      Klik for at tilføje et billede
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Name */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="navn">
              Navn
            </label>
            <input
              type="text"
              id="navn"
              name="navn"
              value={formData.navn}
              onChange={handleChange}
              className="addklient-input"
              required
            />
          </div>

          {/* CPR */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="cpr">
              CPR
            </label>
            <input
              type="text"
              id="cpr"
              name="cpr"
              value={formData.cpr}
              onChange={handleChange}
              className="addklient-input"
            />
          </div>

          {/* Date of Birth */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="fødselsdato">
              Fødselsdato
            </label>
            <input
              type="text"
              id="fødselsdato"
              name="fødselsdato"
              value={formData.fødselsdato}
              onChange={handleChange}
              placeholder="DD-MM-YYYY"
              className="addklient-input"
            />
          </div>

          {/* Email */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="email">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="addklient-input"
              required
            />
          </div>

          {/* Phone */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="telefon">
              Telefon
            </label>
            <div className="addklient-phone-group">
              <select
                name="telefonLand"
                value={formData.telefonLand}
                onChange={handleChange}
                className="addklient-phone-country"
              >
                <option value="+45">+45</option>
                <option value="+46">+46</option>
                <option value="+47">+47</option>
                <option value="+358">+358</option>
              </select>
              <input
                type="tel"
                id="telefon"
                name="telefon"
                value={formData.telefon}
                onChange={handleChange}
                className="addklient-input addklient-phone-input"
              />
            </div>
          </div>

          {/* Address */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="adresse">
              Adresse
            </label>
            <input
              type="text"
              id="adresse"
              name="adresse"
              value={formData.adresse}
              onChange={handleChange}
              className="addklient-input"
            />
            {!showAddressLine2 && (
              <button
                type="button"
                className="addklient-add-line-btn"
                onClick={() => setShowAddressLine2(true)}
              >
                Tilføj 2. linje
              </button>
            )}
            {showAddressLine2 && (
              <input
                type="text"
                name="adresse2"
                value={formData.adresse2}
                onChange={handleChange}
                className="addklient-input addklient-input-margin-top"
                placeholder="Adresse 2. linje"
              />
            )}
          </div>

          {/* Postal Code and City */}
          <div className="addklient-form-row">
            <div className="addklient-form-section addklient-form-section-half">
              <label className="addklient-form-label" htmlFor="postnummer">
                Postnummer
              </label>
              <input
                type="text"
                id="postnummer"
                name="postnummer"
                value={formData.postnummer}
                onChange={handleChange}
                className="addklient-input"
              />
            </div>
            <div className="addklient-form-section addklient-form-section-half">
              <label className="addklient-form-label" htmlFor="by">
                By
              </label>
              <input
                type="text"
                id="by"
                name="by"
                value={formData.by}
                onChange={handleChange}
                className="addklient-input"
              />
            </div>
          </div>

          {/* Region */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="region">
              Region
            </label>
            <input
              type="text"
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="addklient-input"
            />
          </div>

          {/* Country */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="land">
              Land
            </label>
            <select
              id="land"
              name="land"
              value={formData.land}
              onChange={handleChange}
              className="addklient-select"
            >
              <option value="Danmark">Danmark</option>
              <option value="Sverige">Sverige</option>
              <option value="Norge">Norge</option>
              <option value="Finland">Finland</option>
              <option value="Tyskland">Tyskland</option>
            </select>
          </div>

          {/* Notes */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="noter">
              Noter
            </label>
            <textarea
              id="noter"
              name="noter"
              value={formData.noter}
              onChange={handleChange}
              className="addklient-textarea"
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div className="addklient-form-actions">
            <button
              type="button"
              className="addklient-cancel-btn"
              onClick={handleCancel}
            >
              Annuller
            </button>
            <button type="submit" className="addklient-save-btn">
              Gem
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddKlient;

