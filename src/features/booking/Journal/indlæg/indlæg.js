import React, { useRef, useState } from 'react';
import './indlæg.css';
import Whisper from './whisper';

const PROJECT_ID = process.env.REACT_APP_PROJECT_ID || '';
const FUNCTION_REGION = process.env.REACT_APP_FUNCTION_REGION || 'us-central1';

const buildDefaultTranscribeUrl = () => {
  if (!PROJECT_ID) {
    return '';
  }

  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    return `http://127.0.0.1:5001/${PROJECT_ID}/${FUNCTION_REGION}/transcribe_audio`;
  }

  return `https://${FUNCTION_REGION}-${PROJECT_ID}.cloudfunctions.net/transcribe_audio`;
};

const TRANSCRIBE_FUNCTION_URL =
  process.env.REACT_APP_TRANSCRIBE_URL || buildDefaultTranscribeUrl();

function Indlæg({ clientName, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('14-11-2025');
  const [isPrivate, setIsPrivate] = useState(false);
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [dictationStatus, setDictationStatus] = useState('');
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const handleSave = () => {
    const newEntry = {
      id: Date.now(),
      title,
      date,
      content,
      isPrivate,
      isStarred: false,
      isLocked: false,
    };
    
    if (typeof onSave === 'function') {
      onSave(newEntry);
    }
    
    onClose();
  };

  const handleSaveDraft = () => {
    // Handle save as draft
    console.log('Save as draft');
    const draftEntry = {
      id: Date.now(),
      title,
      date,
      content,
      isPrivate,
      isDraft: true,
    };
    
    if (typeof onSave === 'function') {
      onSave(draftEntry);
    }
    
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleAddFile = () => {
    // Handle add journal file
    console.log('Add journal file');
  };

  const handleUpload = () => {
    // Handle upload
    console.log('Upload');
  };

  const handlePrint = () => {
    // Handle print
    console.log('Print');
  };

  const startDictation = async () => {
    try {
      if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
        setDictationStatus('Din browser understøtter ikke diktering.');
        return;
      }

      if (!TRANSCRIBE_FUNCTION_URL) {
        setDictationStatus('Manglende transskriptions-endpoint.');
        return;
      }

      setDictationStatus('Starter mikrofon...');
      setTranscriptionResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setDictationStatus('Forbereder lyd...');
          await transcribeRecording(blob);
        } catch (error) {
          console.error('Transcription error:', error);
          setDictationStatus('Fejl under transskription.');
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsDictating(true);
      setDictationStatus('Lytter....');
    } catch (error) {
      console.error('Microphone error:', error);
      setDictationStatus('Kunne ikke få adgang til mikrofonen.');
      setIsDictating(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const transcribeRecording = async (audioBlob) => {
    if (!TRANSCRIBE_FUNCTION_URL) {
      setDictationStatus('Manglende transskriptions-endpoint.');
      return;
    }

    setDictationStatus('Genererer tekst...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('response_format', 'text');

    try {
      const response = await fetch(TRANSCRIBE_FUNCTION_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Server ${response.status}: ${errorMessage}`);
      }

      const responseBody = await response.text();
      console.log('Transcribe response:', responseBody);

      let parsedResult = null;
      if (responseBody?.trim()) {
        try {
          parsedResult = JSON.parse(responseBody);
        } catch (jsonError) {
          parsedResult = { text: responseBody.trim() };
        }
      }

      if (parsedResult) {
        setTranscriptionResult(parsedResult);
        if (parsedResult.text) {
          setContent((currentContent) => {
            const suffix = currentContent ? '\n\n' : '';
            return `${currentContent || ''}${suffix}${parsedResult.text}`;
          });
        }
        setDictationStatus('Transskription modtaget.');
      } else {
        setDictationStatus('Kunne ikke læse nogen tekst fra svaret.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setDictationStatus('Fejl under transskription.');
    }
  };

  const stopDictation = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setDictationStatus('Stopper optagelse...');
    }
    setIsDictating(false);
  };

  const handleMikrofonClick = () => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  return (
    <div className="indlæg-container">
      {/* Header */}
      <div className="indlæg-header">
        <div className="indlæg-header-top">
          <h2 className="indlæg-title">Journal for {clientName}</h2>
          <div className="indlæg-header-actions">
            <button className="indlæg-action-btn" title="Nyt indlæg">
              <span className="indlæg-action-icon">−</span>
              Nyt indlæg
            </button>
            <button className="indlæg-action-btn" onClick={handleAddFile} title="Tilføj Journalfil">
              <span className="indlæg-action-icon">📁</span>
              Tilføj Journalfil
            </button>
            <button className="indlæg-icon-btn" onClick={handleUpload} title="Upload">
              ☁️
            </button>
            <button className="indlæg-icon-btn" onClick={handlePrint} title="Print">
              🖨️
            </button>
            <button className="indlæg-close-btn" onClick={handleCancel}>✕</button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="indlæg-search-bar">
          <input
            type="text"
            placeholder="Søg..."
            className="indlæg-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="indlæg-content">
        {/* Title and Date Section */}
        <div className="indlæg-form-section">
          <div className="indlæg-form-row">
            <div className="indlæg-form-group">
              <label className="indlæg-label">Titel</label>
              <input
                type="text"
                className="indlæg-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Indtast titel..."
              />
            </div>
            <div className="indlæg-form-group">
              <label className="indlæg-label">Dato</label>
              <input
                type="text"
                className="indlæg-input indlæg-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="dd-mm-yyyy"
              />
            </div>
          </div>
        </div>

        {/* Private Journal Toggle */}
        <div className="indlæg-form-section">
          <div className="indlæg-toggle-group">
            <label className="indlæg-toggle-label">
              <input
                type="checkbox"
                className="indlæg-toggle-input"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span className="indlæg-toggle-slider"></span>
            </label>
            <div className="indlæg-toggle-text-group">
              <span className="indlæg-label">Privat journal</span>
              <button className="indlæg-help-btn" title="Hjælp">?</button>
            </div>
          </div>
        </div>

        {/* Rich Text Editor Toolbar */}
        <div className="indlæg-form-section">
          <label className="indlæg-label">Indhold</label>
          <div className="indlæg-editor-toolbar">
            <button className="indlæg-toolbar-btn" title="Fortryd">↶</button>
            <button className="indlæg-toolbar-btn" title="Gentag">↷</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Fed">B</button>
            <button className="indlæg-toolbar-btn" title="Kursiv">I</button>
            <button className="indlæg-toolbar-btn" title="Understreg">U</button>
            <button className="indlæg-toolbar-btn" title="Gennemstreg">S</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Punktliste">•</button>
            <button className="indlæg-toolbar-btn" title="Nummereret liste">1.</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Venstrejuster">◀</button>
            <button className="indlæg-toolbar-btn" title="Centrer">⬌</button>
            <button className="indlæg-toolbar-btn" title="Højrejuster">▶</button>
            <div className="indlæg-toolbar-divider"></div>
            <select className="indlæg-toolbar-select">
              <option>Afsnit</option>
            </select>
            <button className="indlæg-toolbar-btn" title="Indsæt link">🔗</button>
            <button className="indlæg-toolbar-btn" title="Indsæt tabel">⊞</button>
            <button className="indlæg-toolbar-btn" title="Indsæt billede">🖼️</button>
          </div>
          
          {/* Content Textarea */}
          <textarea
            className="indlæg-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Indtast indhold..."
            rows={15}
          />
          <div className="indlæg-mikrofon-container">
            <button
              type="button"
              className={`indlæg-mikrofon-btn${isDictating ? ' active' : ''}`}
              onClick={handleMikrofonClick}
              title={isDictating ? 'Stop diktering' : 'Start diktering'}
              aria-pressed={isDictating}
            >
              <span className="indlæg-mikrofon-icon">🎤</span>
              Mikrofon
            </button>
            {dictationStatus && (
              <p className="indlæg-dictation-status">{dictationStatus}</p>
            )}
          </div>
          {transcriptionResult && <Whisper data={transcriptionResult} />}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="indlæg-footer">
        <button className="indlæg-cancel-btn" onClick={handleCancel}>
          ✕ Annuller
        </button>
        <button className="indlæg-draft-btn" onClick={handleSaveDraft}>
          Gem som kladde
        </button>
        <button className="indlæg-save-btn" onClick={handleSave}>
          <span className="indlæg-save-icon">💾</span>
          Gem og luk
        </button>
      </div>
    </div>
  );
}

export default Indlæg;
