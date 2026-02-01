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
import AnimatedGenerateButton from '../../../components/ui/animated-generate-button-shadcn-tailwind';
import '../Journal/indlæg/indlæg.css';
import { useLanguage } from '../../../LanguageContext';

const DEFAULT_AVATARS = {
  user:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop',
  ai: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop',
};

export const parseAssistantSections = (markdownText, fallbackTitle = 'Answer') => {
  const lines = `${markdownText || ''}`.split(/\r?\n/);
  const sections = [];
  let current = null;

  const flushCurrent = () => {
    if (!current) return;
    const content = current.content.trim();
    sections.push({
      title: current.title || fallbackTitle,
      content,
    });
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^###\s+(.*)/);
    if (headingMatch) {
      flushCurrent();
      current = { title: headingMatch[1].trim(), content: '' };
      return;
    }
    if (!current) {
      current = { title: '', content: line };
      return;
    }
    current.content += `${current.content ? '\n' : ''}${line}`;
  });

  flushCurrent();

  if (!sections.length) {
    return [
      {
        title: fallbackTitle,
        content: `${markdownText || ''}`.trim(),
      },
    ];
  }

  if (!sections.some((section) => section.title && section.title !== fallbackTitle)) {
    return [
      {
        title: fallbackTitle,
        content: `${markdownText || ''}`.trim(),
      },
    ];
  }

  return sections;
};

const AssistantAccordionResponse = ({ sections }) => {
  const [openStates, setOpenStates] = React.useState([]);

  React.useEffect(() => {
    setOpenStates(sections.map(() => false));
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
              {section.title}
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
                {section.content || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

function CortiAssistantPanel({
  title = '',
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
  placeholder = '',
  emptyMessageText = '',
  showEmptyHint = false,
  emptyHintText = '',
  chatAvatars = DEFAULT_AVATARS,
  className = '',
  onClose,
}) {
  const { t } = useLanguage();
  const resolvedTitle = title || t('indlaeg.assistantTitle', 'Selma Assistant');
  const resolvedPlaceholder =
    placeholder || t('indlaeg.assistantPlaceholder', 'Ask Selma assistant a question...');
  const resolvedEmptyMessage =
    emptyMessageText || t('assistant.noMessages', 'No messages yet.');
  const resolvedEmptyHint =
    emptyHintText || t('indlaeg.emptyHint', 'No text yet — you can still ask generally.');
  const userLabel = t('assistant.youLabel', 'You');
  const selmaLabel = t('assistant.selmaLabel', 'Selma');
  const userFallback = userLabel.slice(0, 2).toUpperCase();
  const selmaFallback = selmaLabel.slice(0, 2).toUpperCase();
  const effectiveSendDisabled =
    typeof sendDisabled === 'boolean'
      ? sendDisabled
      : inputDisabled || isSending || !inputValue.trim();

  return (
    <div className={`indlæg-card indlæg-card--drawer indlæg-card--assistant ${className}`.trim()}>
      <div className="indlæg-card-header indlæg-card-header--row">
        <h3 className="indlæg-card-title">{resolvedTitle}</h3>
        {onClose ? (
          <button
            type="button"
            className="indlæg-assistant-close"
            onClick={onClose}
            aria-label={t('indlaeg.assistantCloseShort', 'Close assistant')}
          >
            ✕
          </button>
        ) : statusText ? (
          <span className="indlæg-status-pill indlæg-status-pill--default">{statusText}</span>
        ) : null}
      </div>

      <div className="indlæg-card-body indlæg-card-body--assistant">
        {quickActions?.length ? (
          <div className="indlæg-assistant-section">
            <p className="indlæg-assistant-heading">
              {t('assistant.suggestions', 'Suggestions')}
            </p>
            <div className="indlæg-quick-actions">
              {quickActions.map(({ id, label, message, agentType }) => {
                const actionKey = id || label;
                return (
                <button
                  key={actionKey}
                  type="button"
                  className={`indlæg-quick-action${
                    activeQuickAction === actionKey ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    onQuickAction?.(actionKey);
                    onSendMessage?.(message ?? label, agentType, actionKey);
                  }}
                  disabled={actionsDisabled}
                >
                  {label}
                </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="indlæg-agent-chat-panel">
          <div className="indlæg-agent-messages">
            <ChatMessageList smooth className="indlæg-agent-message-list">
              {(!messages || messages.length === 0) && (
                <div className="indlæg-agent-message-empty">
                  <p className="indlæg-muted">{resolvedEmptyMessage}</p>
                </div>
              )}

              {messages?.map((msg) => (
                <ChatBubble
                  key={`${msg.role}-${msg.ts}`}
                  variant={msg.role === 'user' ? 'sent' : 'received'}
                >
                  <ChatBubbleAvatar
                    src={msg.role === 'user' ? chatAvatars.user : chatAvatars.ai}
                  fallback={msg.role === 'user' ? userFallback : selmaFallback}
                    className="shadow-sm"
                  />
                  <div className="flex flex-col gap-1 max-w-full">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {msg.role === 'user' ? userLabel : selmaLabel}
                    </span>
                    <ChatBubbleMessage variant={msg.role === 'user' ? 'sent' : 'received'}>
                      {msg.role === 'assistant' && Array.isArray(msg.sections) ? (
                        <AssistantAccordionResponse sections={msg.sections} />
                      ) : msg.role === 'assistant' ? (
                        msg.text
                      ) : (
                        msg.text
                      )}
                    </ChatBubbleMessage>
                  </div>
                </ChatBubble>
              ))}

              {isSending && (
                <ChatBubble variant="received">
                  <ChatBubbleAvatar src={chatAvatars.ai} fallback={selmaFallback} className="shadow-sm" />
                  <div className="flex flex-col gap-1 max-w-full">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {selmaLabel}
                    </span>
                    <ChatBubbleMessage isLoading />
                  </div>
                </ChatBubble>
              )}
            </ChatMessageList>
          </div>

          {showEmptyHint ? (
            <p className="indlæg-muted indlæg-agent-empty-hint">{resolvedEmptyHint}</p>
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
            placeholder={resolvedPlaceholder}
            rows={2}
            disabled={inputDisabled}
          />
          <div className="indlæg-agent-send">
            <AnimatedGenerateButton
              type="button"
              className="indlæg-selma-btn w-full"
              labelIdle={t('assistant.send', 'Send')}
              labelActive={t('assistant.sending', 'Sending...')}
              generating={isSending}
              onClick={() => onSendMessage?.()}
              disabled={effectiveSendDisabled}
              ariaLabel={t('assistant.send', 'Send')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CortiAssistantPanel;
