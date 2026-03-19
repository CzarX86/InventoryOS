"use client";

export default function ErrorNotice({ error, onReport = null, reporting = false, className = "" }) {
  if (!error) return null;

  const canReport = Boolean(onReport && error.errorId && !error.reportedByUser);

  return (
    <div className={`px-5 md:px-6 py-4 bg-red-500/10 border-b border-white/[0.08] ${className}`}>
      <p className="text-sm font-bold text-red-300">{error.humanMessage}</p>

      {error.knownReason && (
        <p className="text-xs text-zinc-300 mt-1">
          Motivo identificado: {error.knownReason}
        </p>
      )}

      {Array.isArray(error.userActions) && error.userActions.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-200">
          {error.userActions.map(action => (
            <li key={action}>• {action}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {error.reportedByUser ? (
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Log enviado · {error.ticketId || error.errorId}
          </span>
        ) : (
          canReport && (
            <button
              type="button"
              onClick={onReport}
              disabled={reporting}
              className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
            >
              {reporting ? "Enviando..." : "Enviar log para suporte"}
            </button>
          )
        )}

        {error.errorId && (
          <span className="text-[11px] font-mono text-zinc-400">
            {error.errorId}
          </span>
        )}
      </div>
    </div>
  );
}
