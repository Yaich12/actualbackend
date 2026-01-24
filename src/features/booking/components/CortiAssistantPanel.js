import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from '../../../components/ui/chat-bubble';
import { ChatInput } from '../../../components/ui/chat-input';
import { ChatMessageList } from '../../../components/ui/chat-message-list';
import { Button } from '../../../components/ui/button';
import '../Journal/indlæg/indlæg.css';

const DEFAULT_AVATARS = {
  user:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop',
  ai: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop',
};

const parseMarkdownSections = (text) => {
  const lines = `${text || ''}`.split(/\r?\n/);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const headingMatch = line.match(/^###\s+(.*)/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), body: '' };
    } else {
      if (!current) {
        current = { title: '', body: line };
      } else {
        current.body += `${current.body ? '\n' : ''}${line}`;
      }
    }
  });

  if (current) sections.push(current);

  if (sections.length === 0 || !sections.some((s) => s.title)) {
    return [{ title: 'Svar', body: `${text || ''}`.trim() }];
  }

  return sections;
};

const AssistantAccordionResponse = ({ text }) => {
  const sections = React.useMemo(() => parseMarkdownSections(text), [text]);
  const [openStates, setOpenStates] = React.useState([]);

  React.useEffect(() => {
    setOpenStates(sections.map((_, idx) => idx === 0));
  }, [sections]);

  const toggle = (idx) => {
    setOpenStates((prev) => prev.map((open, i) => (i === idx ? !open : open)));
  };

  return (
    <div className="corti-accordion">
      {sections.map((section, idx) => (
        <div key={`sec-${idx}`} className="corti-accordion-item">
          <button
            type="button"
            className="corti-accordion-header"
            onClick={() => toggle(idx)}
            aria-expanded={openStates[idx]}
          >
            <span className="corti-accordion-title">
              {section.title || 'Svar'}
            </span>
            <span
              className={`corti-accordion-icon${openStates[idx] ? ' is-open' : ''}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
          {openStates[idx] && (
            <div className="corti-accordion-body corti-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {section.body || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

function CortiAssistantPanel({
  title = 'Selma Assistent',
  statusText = '',
  quickActions = [],
  activeQuickAction = '',
  onQuickAction,
  onSendMessage,
  messages = [],
  isSending = false,
  actionsDisabled = false,
  errorText = '',
  inputValue = '',
  onInputChange,
  inputDisabled = false,
  sendDisabled,
  placeholder = 'Stil et spørgsmål til Selma assistenten...',
  emptyMessageText = 'Ingen beskeder endnu.',
  showEmptyHint = false,
  emptyHintText = 'Ingen tekst endnu – du kan stadig spørge generelt.',
  chatAvatars = DEFAULT_AVATARS,
  className = '',
}) {
  const effectiveSendDisabled =
    typeof sendDisabled === 'boolean'
      ? sendDisabled
      : inputDisabled || isSending || !inputValue.trim();

  return (
    <div className={`indlæg-card indlæg-card--drawer indlæg-card--assistant ${className}`.trim()}>
      <div className="indlæg-card-header indlæg-card-header--row">
        <h3 className="indlæg-card-title">{title}</h3>
        {statusText ? (
          <span className="indlæg-status-pill indlæg-status-pill--default">{statusText}</span>
        ) : null}
      </div>

      <div className="indlæg-card-body indlæg-card-body--assistant">
        {quickActions?.length ? (
          <div className="indlæg-assistant-section">
            <p className="indlæg-assistant-heading">Forslag</p>
            <div className="indlæg-quick-actions">
              {quickActions.map(({ label, message, agentType }) => (
                <button
                  key={label}
                  type="button"
                  className={`indlæg-quick-action${activeQuickAction === label ? ' is-active' : ''}`}
                  onClick={() => {
                    onQuickAction?.(label);
                    onSendMessage?.(message ?? label, agentType, label);
                  }}
                  disabled={actionsDisabled}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="indlæg-agent-chat-panel">
          <div className="indlæg-agent-messages">
            <ChatMessageList smooth className="indlæg-agent-message-list">
              {(!messages || messages.length === 0) && (
                <div className="indlæg-agent-message-empty">
                  <p className="indlæg-muted">{emptyMessageText}</p>
                </div>
              )}

              {messages?.map((msg) => (
                <ChatBubble
                  key={`${msg.role}-${msg.ts}`}
                  variant={msg.role === 'user' ? 'sent' : 'received'}
                >
                  <ChatBubbleAvatar
                    src={msg.role === 'user' ? chatAvatars.user : chatAvatars.ai}
                    fallback={msg.role === 'user' ? 'DU' : 'AI'}
                    className="shadow-sm"
                  />
                  <div className="flex flex-col gap-1 max-w-full">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {msg.role === 'user' ? 'Dig' : 'Selma'}
                    </span>
                    <ChatBubbleMessage variant={msg.role === 'user' ? 'sent' : 'received'}>
                      {msg.role === 'assistant' ? (
                        <AssistantAccordionResponse text={msg.text} />
                      ) : (
                        msg.text
                      )}
                    </ChatBubbleMessage>
                  </div>
                </ChatBubble>
              ))}

              {isSending && (
                <ChatBubble variant="received">
                  <ChatBubbleAvatar src={chatAvatars.ai} fallback="AI" className="shadow-sm" />
                  <div className="flex flex-col gap-1 max-w-full">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Selma
                    </span>
                    <ChatBubbleMessage isLoading />
                  </div>
                </ChatBubble>
              )}
            </ChatMessageList>
          </div>

          {showEmptyHint ? (
            <p className="indlæg-muted indlæg-agent-empty-hint">{emptyHintText}</p>
          ) : null}
        </div>

        {errorText ? (
          <p className="indlæg-inline-error" role="alert">
            {errorText}
          </p>
        ) : null}

        <div className="indlæg-agent-input indlæg-agent-input--modern">
          <ChatInput
            className="bg-white"
            value={inputValue}
            onChange={(event) => onInputChange?.(event.target.value)}
            placeholder={placeholder}
            rows={2}
            disabled={inputDisabled}
          />
          <Button
            type="button"
            onClick={() => onSendMessage?.()}
            disabled={effectiveSendDisabled}
            size="sm"
            className="shrink-0"
          >
            {isSending ? 'Sender...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CortiAssistantPanel;
