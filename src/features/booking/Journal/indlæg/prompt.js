import React, { useState } from 'react';
import './prompt.css';

const PROJECT_ID = process.env.REACT_APP_PROJECT_ID || '';
const FUNCTION_REGION = process.env.REACT_APP_FUNCTION_REGION || 'us-central1';

const buildDefaultCompletionUrl = () => {
  if (!PROJECT_ID) {
    return '';
  }

  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    return `http://127.0.0.1:5501/${PROJECT_ID}/${FUNCTION_REGION}/openai_completion`;
  }

  return `https://${FUNCTION_REGION}-${PROJECT_ID}.cloudfunctions.net/openai_completion`;
};

const COMPLETION_FUNCTION_URL =
  process.env.REACT_APP_COMPLETION_URL || buildDefaultCompletionUrl();

function Prompt({ onResult }) {
  const [userPrompt, setUserPrompt] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userPrompt.trim()) {
      return;
    }

    if (!COMPLETION_FUNCTION_URL) {
      setError('Manglende completion-endpoint.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(COMPLETION_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userprompt: userPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server ${response.status}`);
      }

      const data = await response.json();
      
      // Robust extraction of text from various potential response formats
      let output = 'No response';
      
      try {
        // Case 1: Direct string in output
        if (typeof data.output === 'string') {
          output = data.output;
        }
        // Case 2: Array format (like the one you pasted)
        else if (Array.isArray(data.output) && data.output.length > 0) {
          const firstItem = data.output[0];
          if (firstItem.content && Array.isArray(firstItem.content) && firstItem.content.length > 0) {
            output = firstItem.content[0].text || JSON.stringify(firstItem.content);
          } else if (firstItem.message && firstItem.message.content) {
             output = firstItem.message.content;
          } else {
            output = JSON.stringify(data.output);
          }
        }
        // Case 3: Nested message object
        else if (data.message?.content) {
          output = data.message.content;
        }
        // Case 4: Fallback to JSON stringify if it's an object/array
        else if (data.output && typeof data.output === 'object') {
          output = JSON.stringify(data.output);
        }
      } catch (e) {
        console.error('Error parsing output:', e);
        output = JSON.stringify(data);
      }

      // Add to prompts list
      const newPrompt = {
        id: Date.now(),
        prompt: userPrompt,
        response: output,
        timestamp: new Date().toISOString(),
      };

      if (typeof onResult === 'function') {
        onResult(output);
      }

      setPrompts((prev) => [newPrompt, ...prev]);
      setUserPrompt('');
      
      // Log to console
      console.log('OpenAI completion output:', output);
    } catch (err) {
      console.error('Completion error:', err);
      setError(err.message || 'Fejl under completion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="prompt-container">
      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="prompt-input-group">
          <input
            type="text"
            className="prompt-input"
            placeholder="What do you wanna know?"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="prompt-submit-btn"
            disabled={isLoading || !userPrompt.trim()}
          >
            {isLoading ? 'Loading...' : 'Submit'}
          </button>
        </div>
        {error && <p className="prompt-error">{error}</p>}
      </form>

      <div className="prompt-history">
        <h3 className="prompt-history-title">Your Prompts:</h3>
        {prompts.length === 0 ? (
          <p className="prompt-empty">No prompts yet. Start by adding one!</p>
        ) : (
          <div className="prompt-list">
            {prompts.map((item) => (
              <div key={item.id} className="prompt-item">
                <div className="prompt-item-prompt">
                  <strong>Prompt:</strong> {item.prompt}
                </div>
                <div className="prompt-item-response">
                  <strong>Response:</strong> {item.response}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Prompt;

