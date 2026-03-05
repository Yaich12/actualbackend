import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildApiUrl } from "../../utils/runtimeUrls";

const cardClass =
  "w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

export default function PaymentReceiptPage() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const paymentState = `${params.get("payment") || ""}`.trim().toLowerCase();
  const sessionId = `${params.get("session_id") || ""}`.trim();

  const [loading, setLoading] = useState(paymentState === "success" && Boolean(sessionId));
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (paymentState !== "success" || !sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadReceipt = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          buildApiUrl(`/api/stripe/connect/public-sale-receipt?session_id=${encodeURIComponent(sessionId)}`)
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || `Request failed (${response.status})`);
        }
        if (!cancelled) {
          setReceipt(data || null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.message || "Kunne ikke hente kvittering.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [paymentState, sessionId]);

  const isCancel = paymentState === "cancel";
  const isPaid = receipt?.paid === true;
  const amountLabel = receipt?.receipt?.amountLabel || "";
  const appointmentRef = receipt?.receipt?.appointmentRef || "";
  const receiptEmailSent = receipt?.receipt?.receiptEmailSent === true;
  const receiptEmailError = `${receipt?.receipt?.receiptEmailError || ""}`.trim();
  const saleSynced = receipt?.receipt?.saleSynced === true;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <div className={cardClass}>
          {isCancel ? (
            <>
              <div className="mb-2 text-sm font-semibold text-amber-700">Betaling afbrudt</div>
              <h1 className="text-2xl font-semibold text-slate-900">Betalingen blev annulleret</h1>
              <p className="mt-3 text-sm text-slate-600">
                Du har ikke gennemført betalingen endnu. Brug samme betalingslink igen for at fortsætte.
              </p>
            </>
          ) : loading ? (
            <>
              <div className="mb-2 text-sm font-semibold text-slate-600">Behandler betaling</div>
              <h1 className="text-2xl font-semibold text-slate-900">Bekræfter din betaling...</h1>
              <p className="mt-3 text-sm text-slate-600">
                Vi henter kvitteringen og opdaterer siden automatisk.
              </p>
            </>
          ) : error ? (
            <>
              <div className="mb-2 text-sm font-semibold text-rose-700">Kunne ikke hente kvittering</div>
              <h1 className="text-2xl font-semibold text-slate-900">Betalingsstatus er ukendt</h1>
              <p className="mt-3 text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Opdatér side
              </button>
            </>
          ) : isPaid ? (
            <>
              <div className="mb-2 text-sm font-semibold text-emerald-700">Betaling gennemført</div>
              <h1 className="text-2xl font-semibold text-slate-900">Tak, din betaling er modtaget</h1>
              <p className="mt-3 text-sm text-slate-600">
                {receiptEmailSent
                  ? "Kvittering er sendt til din e-mail. Klinikkens system er opdateret i Selma+."
                  : "Betaling er registreret. Kvittering behandles og sendes til din e-mail hurtigst muligt."}
              </p>
              {!saleSynced ? (
                <p className="mt-2 text-sm text-slate-500">
                  Vi opdaterer stadig klinikkens system. Det sker normalt inden for få sekunder.
                </p>
              ) : null}
              {receiptEmailError ? (
                <p className="mt-2 text-sm text-amber-700">
                  Kvitteringsmail kunne ikke bekræftes automatisk endnu.
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <div className="flex items-center justify-between gap-3">
                  <span>Beløb</span>
                  <span className="font-semibold">{amountLabel || "—"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Reference</span>
                  <span className="font-semibold">{appointmentRef || "—"}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 text-sm font-semibold text-slate-600">Betalingsstatus</div>
              <h1 className="text-2xl font-semibold text-slate-900">Vi afventer bekræftelse</h1>
              <p className="mt-3 text-sm text-slate-600">
                Betalingen registreres typisk med det samme. Opdatér siden om et øjeblik.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Opdatér side
              </button>
            </>
          )}
        </div>

        <div className="text-center text-sm text-slate-500">
          <p>SelmaPay drives af Stripe (Express).</p>
          <p className="mt-1">
            <Link to="/" className="font-semibold text-slate-700 hover:text-slate-900">
              Tilbage til selmaplus.tech
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
