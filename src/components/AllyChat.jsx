import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";

const emptyTags = { booking_proposals: [], email_drafts: [] };
const DEFAULT_BOOKING_DURATION_MINUTES = 60;

const parseBookingDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const dateToken = String(dateValue).trim().split(/\s+/)[0];
  const dateParts = dateToken.split(/[./-]/).map((part) => part.trim());
  if (dateParts.length !== 3) return null;

  let year;
  let month;
  let day;

  if (dateParts[0].length === 4) {
    year = Number(dateParts[0]);
    month = Number(dateParts[1]);
    day = Number(dateParts[2]);
  } else if (dateParts[2].length === 4) {
    year = Number(dateParts[2]);
    month = Number(dateParts[1]);
    day = Number(dateParts[0]);
  } else {
    year = Number(dateParts[2]);
    if (year < 100) {
      year += 2000;
    }
    month = Number(dateParts[1]);
    day = Number(dateParts[0]);
  }

  const timeToken = String(timeValue).split(/[–-]/)[0];
  const timeMatch = timeToken.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export default function AllyChat({ patientData, onBookingSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "ally-welcome",
      role: "assistant",
      content: "Hej! Hvordan kan jeg hjælpe med patienten i dag?",
      tags: emptyTags,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionState, setActionState] = useState({});
  const [toastMessage, setToastMessage] = useState("");
  const listRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const container = listRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, loading, isOpen]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage("");
    }, 2200);
  };

  const updateActionState = (messageId, action, updates) => {
    setActionState((prev) => {
      const messageState = prev[messageId] || {};
      const actionStatus = messageState[action] || {};
      return {
        ...prev,
        [messageId]: {
          ...messageState,
          [action]: { ...actionStatus, ...updates },
        },
      };
    });
  };

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || loading) return;
    setErrorMessage("");
    setInputValue("");

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      tags: emptyTags,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          patient_data: patientData || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server fejl (${response.status})`);
      }

      const data = await response.json();
      const replyText = data?.reply || "Ingen svar fra Ally.";
      const tags = data?.tags || emptyTags;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: replyText,
          tags,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noget gik galt.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleConfirmBooking = async (messageId, proposal) => {
    if (!proposal) return;
    updateActionState(messageId, "booking", { loading: true });
    setErrorMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/confirm-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: proposal.date,
          time: proposal.time,
          patient_id: patientData?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server fejl (${response.status})`);
      }

      const parsedStart = parseBookingDateTime(proposal.date, proposal.time);
      if (parsedStart && typeof onBookingSuccess === "function") {
        const parsedEnd = new Date(
          parsedStart.getTime() + DEFAULT_BOOKING_DURATION_MINUTES * 60 * 1000
        );
        onBookingSuccess({
          id: Date.now(),
          title: "Opfølgende konsultation",
          service: "Opfølgende konsultation",
          start: parsedStart,
          end: parsedEnd,
          patient: patientData?.name || "Ukendt patient",
          clientId: patientData?.id || null,
          clientEmail: patientData?.email || "",
          clientPhone: patientData?.phone || "",
          type: "fysioterapi",
        });
      }

      updateActionState(messageId, "booking", { loading: false, done: true });
      showToast("Tid bestilt!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke bekræfte booking.";
      setErrorMessage(message);
      updateActionState(messageId, "booking", { loading: false });
    }
  };

  const handleSendEmail = async (messageId, draft) => {
    if (!draft) return;
    updateActionState(messageId, "email", { loading: true });
    setErrorMessage("");

    const subjectMatch = draft.match(/Subject:\s*(.*)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : "Ally udkast";
    const body = subjectMatch ? draft.replace(subjectMatch[0], "").trim() : draft;

    try {
      const response = await fetch("http://127.0.0.1:8000/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: patientData?.email || "",
          subject,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server fejl (${response.status})`);
      }

      updateActionState(messageId, "email", { loading: false, done: true });
      showToast("Mail sendt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke sende mail.";
      setErrorMessage(message);
      updateActionState(messageId, "email", { loading: false });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {toastMessage && (
        <div className="absolute bottom-20 right-0 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-lg shadow-emerald-500/20">
          {toastMessage}
        </div>
      )}
      <button
        type="button"
        aria-label="Åbn Ally chat"
        onClick={() => setIsOpen(true)}
        className={`group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-indigo-500/50 ${
          isOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <span className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="absolute inset-0 rounded-full animate-pulse bg-white/10" />
        <Sparkles className="relative h-6 w-6" />
      </button>

      <div
        className={`absolute bottom-20 right-0 w-[350px] origin-bottom-right transition-all duration-300 ${
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="flex h-[500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 text-slate-100 shadow-2xl shadow-slate-950/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Ally AI</p>
              <p className="text-xs text-slate-300">
                Klinisk sparring og assistent.
              </p>
            </div>
            <button
              type="button"
              aria-label="Luk chat"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              const bookingProposals = message.tags?.booking_proposals || [];
              const emailDrafts = message.tags?.email_drafts || [];
              const bookingStatus = actionState[message.id]?.booking || {};
              const emailStatus = actionState[message.id]?.email || {};
              const activeBooking = bookingProposals[0];
              const activeEmailDraft = emailDrafts[0];

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-white text-slate-900 shadow-md shadow-white/10"
                        : "bg-white/10 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>

                    {!isUser &&
                      (bookingProposals.length > 0 || emailDrafts.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {bookingProposals.length > 0 && (
                            <>
                              {bookingStatus.done ? (
                                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                                  ✅ Booking Bekræftet
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={bookingStatus.loading}
                                  onClick={() =>
                                    handleConfirmBooking(message.id, activeBooking)
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {bookingStatus.loading ? (
                                    <>
                                      <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-transparent" />
                                      Bekræfter...
                                    </>
                                  ) : (
                                    "📅 Bekræft Booking"
                                  )}
                                </button>
                              )}
                            </>
                          )}
                          {emailDrafts.length > 0 && (
                            <>
                              {emailStatus.done ? (
                                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                                  ✅ Mail Sendt
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={emailStatus.loading}
                                  onClick={() =>
                                    handleSendEmail(message.id, activeEmailDraft)
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {emailStatus.loading ? (
                                    <>
                                      <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-transparent" />
                                      Sender...
                                    </>
                                  ) : (
                                    "✉️ Send Mail"
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-xs text-slate-200">
                  Ally skriver...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            {errorMessage && (
              <p className="mb-2 text-xs text-rose-300">{errorMessage}</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Skriv en besked..."
                className="min-h-[42px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !inputValue.trim()}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  loading || !inputValue.trim()
                    ? "cursor-not-allowed bg-white/10 text-slate-400"
                    : "bg-white text-slate-900 hover:bg-slate-200"
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
