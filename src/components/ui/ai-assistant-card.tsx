import { SparklesIcon } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Textarea } from './textarea';
import { useAuth } from '../../AuthContext';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { getAuth } from 'firebase/auth';

type AiAssistantCardProps = {
  agentId?: 'reasoner' | 'guidelines' | 'planner' | string | null;
  clientId?: string | null;
  agentTitle?: string;
  clientName?: string | null;
  draftText?: string;
  onInsert?: (text: string, mode?: 'append' | 'replace') => void;
};

type AiBlock = {
  id: string;
  title: string;
  text: string;
  defaultMode?: 'append' | 'replace';
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  agentId?: string;
  createdAtMs?: number;
  blocks?: AiBlock[];
};

export const Component = ({ agentId, clientId, agentTitle, clientName, draftText, onInsert }: AiAssistantCardProps) => {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const displayName =
    (user?.displayName && user.displayName.trim()) ||
    (user?.email && user.email.trim()) ||
    'der';

  const patientLabel = (clientName || '').trim();
  const headline = agentTitle || 'Agent 1 · Ræsonnering';

  const actions = useMemo(() => {
    const common = [{ id: 'journal_pack', label: 'Journal Pack (auto)', hint: 'Kører alle agenter' }];
    if (agentId === 'reasoner') {
      return [
        ...common,
        { id: 'soap', label: 'Strukturér (SOAP)', hint: 'Gør kladden klinisk' },
        { id: 'missing', label: 'Manglende data', hint: 'Hvad mangler jeg?' },
        { id: 'redflags', label: 'Safety check', hint: 'Røde flag' },
      ];
    }
    if (agentId === 'guidelines') {
      return [
        ...common,
        { id: 'plan_check', label: 'Plan-check', hint: 'Er planen best practice?' },
        { id: 'dosage', label: 'Dosering & progression', hint: 'Sæt/reps/tempo/pause' },
        { id: 'patient_info', label: 'Patientinfo', hint: 'Kort tekst til borger' },
      ];
    }
    if (agentId === 'planner') {
      return [
        ...common,
        { id: 'today_training', label: 'Dagens træning', hint: 'Konkrete øvelser i dag' },
        { id: 'home_program', label: 'Hjemmeprogram', hint: 'Næste dage + progression' },
        { id: 'next_appt', label: 'Næste aftale', hint: 'Interval + begrundelse' },
      ];
    }
    return common;
  }, [agentId]);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const applyTemplate = (value: string) => {
    setInput(value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  React.useEffect(() => {
    if (!user?.uid || !clientId) {
      setMessages([]);
      return;
    }

    const colRef = collection(
      db,
      'users',
      user.uid,
      'clients',
      clientId,
      'aiChats',
      'shared',
      'messages'
    );
    const q = query(colRef, orderBy('createdAtMs', 'asc'), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            role: data.role,
            text: data.text || '',
            agentId: data.agentId || null,
            createdAtMs: data.createdAtMs || null,
            blocks: Array.isArray(data.blocks) ? data.blocks : undefined,
          } as ChatMessage;
        });
        setMessages(mapped);
      },
      (err) => {
        console.error('[AiAssistantCard] failed to load messages', err);
      }
    );
    return () => unsub();
  }, [user?.uid, clientId]);

  const sendMessage = async () => {
    const text = (input || '').trim();
    if (!text) return;
    if (!agentId || !clientId) {
      setSendError('Mangler agent eller patient.');
      return;
    }
    if (!process.env.REACT_APP_AGENT_CHAT_URL) {
      setSendError('Manglende URL (REACT_APP_AGENT_CHAT_URL).');
      return;
    }

    try {
      setIsSending(true);
      setSendError('');
      setInput('');

      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        setSendError('Kunne ikke hente login-token.');
        return;
      }

      const res = await fetch(process.env.REACT_APP_AGENT_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId, clientId, message: text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[AiAssistantCard] agent_chat error', data);
        setSendError(data?.error || 'Kunne ikke sende besked.');
      }
    } catch (err) {
      console.error(err);
      setSendError('Der opstod en fejl. Prøv igen.');
    } finally {
      setIsSending(false);
    }
  };

  const runAction = async (actionId: string) => {
    if (!agentId || !clientId) {
      setSendError('Mangler agent eller patient.');
      return;
    }
    if (!process.env.REACT_APP_AGENT_CHAT_URL) {
      setSendError('Manglende URL (REACT_APP_AGENT_CHAT_URL).');
      return;
    }

    try {
      setIsSending(true);
      setSendError('');

      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        setSendError('Kunne ikke hente login-token.');
        return;
      }

      await fetch(process.env.REACT_APP_AGENT_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId,
          clientId,
          actionId,
          draftText: draftText || '',
        }),
      });
    } catch (err) {
      console.error(err);
      setSendError('Kunne ikke køre action.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="flex h-full min-h-[800px] w-full max-w-[480px] flex-col gap-6 p-4 shadow-none">
      <div className="flex flex-row items-center justify-end p-0">
        <Button variant="ghost" size="icon" className="size-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            className="size-4 text-muted-foreground"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"
            />
          </svg>
        </Button>
        <Button variant="ghost" size="icon" className="size-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 text-muted-foreground"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </Button>
      </div>
      <CardContent className="flex flex-1 flex-col p-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-8 p-6">
          <svg fill="none" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg">
            {/* SVG content truncated for brevity */}
            <rect height="48" rx="12" width="48" fill="#0A0D12" />
          </svg>

          <div className="flex flex-col space-y-2.5 text-center">
            <div className="flex flex-col">
              <h2 className="text-xl font-medium tracking-tight text-muted-foreground">Hej {displayName},</h2>
              <h3 className="text-lg font-medium tracking-[-0.006em]">{headline}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {patientLabel
                ? `Jeg kan hjælpe dig med klinisk ræsonnering, opsummering og planlægning for ${patientLabel}. Vælg en genvej eller skriv dit spørgsmål.`
                : 'Jeg kan hjælpe dig med klinisk ræsonnering, opsummering og planlægning. Vælg en genvej eller skriv dit spørgsmål.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {actions.map((a) => (
              <Badge
                key={a.id}
                variant="secondary"
                className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs rounded-md"
                title={a.hint}
                onClick={() => void runAction(a.id)}
              >
                <SparklesIcon aria-hidden="true" className="h-3.5 w-3.5 text-purple-500" />
                {a.label}
              </Badge>
            ))}
          </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-auto rounded-md border bg-muted/10 p-3">
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Badge
                  key={a.id}
                  variant="secondary"
                  className="h-7 cursor-pointer gap-1.5 text-xs rounded-md"
                  title={a.hint}
                  onClick={() => void runAction(a.id)}
                >
                  <SparklesIcon aria-hidden="true" className="h-3.5 w-3.5 text-purple-500" />
                  {a.label}
                </Badge>
              ))}
            </div>
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-lg bg-slate-900 text-white px-3 py-2 text-sm whitespace-pre-wrap'
                    : 'mr-auto max-w-[85%] rounded-lg bg-white border px-3 py-2 text-sm whitespace-pre-wrap'
                }
              >
                {m.role === 'assistant' && m.agentId ? (
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {m.agentId === 'reasoner'
                      ? 'Agent 1'
                      : m.agentId === 'guidelines'
                      ? 'Agent 2'
                      : m.agentId === 'planner'
                      ? 'Agent 3'
                      : m.agentId}
                  </div>
                ) : null}
                {m.blocks?.length ? (
                  <div className="space-y-2">
                    {m.blocks.map((b) => (
                      <div key={b.id} className="rounded-md border bg-white p-3">
                        <div className="text-sm font-medium">{b.title}</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm">{b.text}</div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              onInsert?.(
                                `\n\n${b.title}\n${'-'.repeat(b.title.length)}\n${b.text}`,
                                b.defaultMode || 'append'
                              )
                            }
                          >
                            Indsæt i journal
                          </Button>
                          <Button
                            className="h-7 px-2 text-xs"
                            variant="ghost"
                            onClick={() => onInsert?.(`${b.title}\n${b.text}`, 'replace')}
                          >
                            Erstat hele journal
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>{m.text}</>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="relative mt-auto flex-col rounded-md ring-1 ring-border">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv til agenten…"
              className="peer bg-transparent min-h-[100px] resize-none rounded-b-none border-none py-3 ps-9 pe-9 shadow-none"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />

            <div className="pointer-events-none absolute start-0 top-[14px] flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="size-4">
                <g fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11.5" cy="11.5" r="9.5" />
                  <path strokeLinecap="round" d="M18.5 18.5L22 22" />
                </g>
              </svg>
            </div>

            <button
              className="absolute end-0 bottom-7 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 transition-colors outline-none hover:text-foreground focus:z-10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Record audio"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="size-4">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M5.25 8a6.75 6.75 0 0 1 13.5 0v5a6.75 6.75 0 0 1-13.5 0zM12 2.75A5.25 5.25 0 0 0 6.75 8v5a5.25 5.25 0 1 0 10.5 0V8c0-2.9-2.35-5.25-5.25-5.25m-1.485 4.295a.75.75 0 0 1-1.06-1.06l.534.504a37 37 0 0 1-.533-.505v-.001l.002-.002l.004-.003l.008-.008l.064-.06q.054-.047.139-.106c.113-.078.268-.167.473-.25c.41-.165 1.008-.304 1.854-.304s1.444.139 1.854.305c.205.083.36.17.473.249a2 2 0 0 1 .203.166l.008.008l.004.003l.001.002h.001c0 .001.001.002-.533.506l.534-.504a.75.75 0 0 1-1.068 1.055a1 1 0 0 0-.186-.095c-.207-.084-.61-.195-1.291-.195s-1.084.111-1.291.195a1 1 0 0 0-.194.1m0 3.001a.75.75 0 0 1-1.06-1.061L10 9.5a46 46 0 0 1-.544-.516v-.001l.002-.002l.004-.003l.008-.008l.064-.06q.054-.047.139-.106c.113-.078.268-.167.473-.25c.41-.165 1.008-.304 1.854-.304s1.444.139 1.854.305c.205.082.36.17.473.249a2 2 0 0 1 .203.166l.008.008l.004.003l.001.002h.001c0 .001.001.002-.544.517l.545-.515a.75.75 0 0 1-1.06 1.06l-.008-.005a1 1 0 0 0-.186-.095c-.207-.084-.61-.195-1.291-.195s-1.084.111-1.291.195a1 1 0 0 0-.186.095zm2.942-.029h-.001M3 10.25a.75.75 0 0 1 .75.75v2a8.25 8.25 0 0 0 16.5 0v-2a.75.75 0 0 1 1.5 0v2c0 5.385-4.365 9.75-9.75 9.75S2.25 18.385 2.25 13v-2a.75.75 0 0 1 .75-.75"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between rounded-b-md border-t bg-muted/50 px-3 py-2">
            <Select defaultValue="gpt-4">
              <SelectTrigger className="h-7 bg-background text-xs w-[90px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="gpt-4">
                  GPT-4
                </SelectItem>
                <SelectItem className="text-xs" value="gpt-3.5">
                  GPT-3.5
                </SelectItem>
                <SelectItem className="text-xs" value="gpt-3.5-turbo">
                  GPT-3.5 Turbo
                </SelectItem>
                <SelectItem className="text-xs" value="gpt-3.5-turbo-16k">
                  GPT-3.5 Turbo 16k
                </SelectItem>
                <SelectItem className="text-xs" value="gpt-4-32k">
                  GPT-4 32k
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                className="h-7 px-2 gap-2 text-xs"
                onClick={() => void sendMessage()}
                disabled={isSending}
              >
                {isSending ? 'Sender…' : 'Send'}
              </Button>
              <Button className="h-7 px-2 gap-2 text-xs" variant="ghost">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="size-3.5 text-muted-foreground">
                  <path
                    fill="currentColor"
                    d="M6.17 6.309a5.317 5.317 0 0 1 7.522 0a5.326 5.326 0 0 1 0 7.529l-1.43 1.43a.75.75 0 0 0 1.06 1.061l1.43-1.431a6.826 6.826 0 0 0 0-9.65a6.817 6.817 0 0 0-9.644 0l-2.86 2.864A6.826 6.826 0 0 0 6.69 19.749a.75.75 0 1 0 .083-1.498a5.326 5.326 0 0 1-3.465-9.08z"
                  />
                  <path
                    fill="currentColor"
                    d="M17.31 4.251a.75.75 0 0 0-.083 1.498a5.326 5.326 0 0 1 3.465 9.08L17.83 17.69a5.317 5.317 0 0 1-7.523 0a5.326 5.326 0 0 1 0-7.528l1.43-1.432a.75.75 0 0 0-1.06-1.06l-1.43 1.431a6.826 6.826 0 0 0 0 9.65a6.817 6.817 0 0 0 9.644 0l2.86-2.864A6.826 6.826 0 0 0 17.31 4.251"
                  />
                </svg>
                Attach
              </Button>
              <Button className="h-7 px-2 gap-2 text-xs" variant="ghost">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="size-3.5 text-muted-foreground">
                  <g fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" d="M13.294 7.17L12 12l-1.294 4.83" />
                    <path d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z" />
                  </g>
                </svg>
                Shortcuts
              </Button>
            </div>
          </div>
        </div>
        {sendError ? (
          <div className="mt-2 text-xs text-red-600" role="alert">
            {sendError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

