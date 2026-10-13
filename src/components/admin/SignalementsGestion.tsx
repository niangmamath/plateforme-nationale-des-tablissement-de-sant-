// Panneau de traitement des signalements : liste filtrable + détail dans un drawer latéral.
// Actions : changer de statut, écrire une note interne, envoyer une réponse par email au signaleur.
// Toutes les actions passent par /api/admin-ui/signalements* (voir server/adminSignalements.ts).

import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  X, Loader2, Mail as MailIcon, Send, CheckCircle2, XCircle, Clock, AlertCircle,
  Search, FileText, Building2,
} from 'lucide-react';

type Statut = 'nouveau' | 'en_cours' | 'traite' | 'rejete';

interface Signalement {
  id: number;
  type: 'correction' | 'absence';
  etablissement_id: string | null;
  type_probleme: string | null;
  nom_prenom: string;
  email: string;
  profession: string;
  message: string;
  statut: Statut;
  note_interne: string | null;
  date_creation: string;
  date_traitement: string | null;
  traite_par_email: string | null;
  reponse_envoyee_a: string | null;
}

const STATUT_LIBELLE: Record<Statut, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  traite: 'Traité',
  rejete: 'Rejeté',
};

const STATUT_STYLE: Record<Statut, string> = {
  nouveau: 'bg-amber-100 text-amber-800 border-amber-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  traite: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejete: 'bg-slate-100 text-slate-700 border-slate-200',
};

function BadgeStatut({ statut }: { statut: Statut }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUT_STYLE[statut]}`}>
      {STATUT_LIBELLE[statut]}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SignalementsGestion() {
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(0);
  const [selectionne, setSelectionne] = useState<Signalement | null>(null);

  const PAR_PAGE = 25;

  const charger = useCallback(() => {
    setChargement(true); setErreur(null);
    const params = new URLSearchParams();
    if (filtreStatut) params.set('statut', filtreStatut);
    if (recherche.trim()) params.set('q', recherche.trim());
    params.set('limite', String(PAR_PAGE));
    params.set('offset', String(page * PAR_PAGE));
    fetch(`/api/admin-ui/signalements?${params}`, { credentials: 'same-origin' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur serveur');
        return r.json();
      })
      .then((d: { total: number; signalements: Signalement[] }) => {
        setSignalements(d.signalements);
        setTotal(d.total);
      })
      .catch(e => setErreur(e.message))
      .finally(() => setChargement(false));
  }, [filtreStatut, recherche, page]);

  useEffect(() => { charger(); }, [charger]);

  const onMiseAJour = (s: Signalement) => {
    // Remplace la ligne dans la liste et dans le drawer.
    setSignalements(prev => prev.map(x => x.id === s.id ? s : x));
    setSelectionne(s);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 lg:px-6 py-5 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Traitement des signalements</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {total.toLocaleString('fr-FR')} signalement{total > 1 ? 's' : ''} au total
              {filtreStatut && ` — filtré : ${STATUT_LIBELLE[filtreStatut as Statut]}`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={recherche}
              onChange={e => { setRecherche(e.target.value); setPage(0); }}
              placeholder="Rechercher par nom, email ou message…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          >
            <option value="">Tous statuts</option>
            <option value="nouveau">Nouveau</option>
            <option value="en_cours">En cours</option>
            <option value="traite">Traité</option>
            <option value="rejete">Rejeté</option>
          </select>
        </div>
      </div>

      {chargement && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}
      {erreur && (
        <div className="flex items-start gap-3 bg-rose-50 border-t border-rose-200 px-5 py-4">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-800">{erreur}</p>
        </div>
      )}
      {!chargement && !erreur && signalements.length === 0 && (
        <div className="text-center py-16 text-sm text-slate-500">Aucun signalement ne correspond à ces filtres.</div>
      )}

      {!chargement && !erreur && signalements.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50/60 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Signaleur</th>
                  <th className="text-left px-3 py-3 font-semibold">Type</th>
                  <th className="text-left px-3 py-3 font-semibold">Message</th>
                  <th className="text-left px-3 py-3 font-semibold">Reçu</th>
                  <th className="text-left px-3 py-3 font-semibold">Statut</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {signalements.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors" onClick={() => setSelectionne(s)}>
                    <td className="px-5 lg:px-6 py-3 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{s.nom_prenom}</div>
                      <div className="text-xs text-slate-500 truncate">{s.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                        {s.type === 'correction' ? <FileText className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                        {s.type === 'correction' ? 'Correction' : 'Absence'}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[300px]">
                      <div className="text-xs text-slate-600 line-clamp-2">{s.message}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(s.date_creation)}</td>
                    <td className="px-3 py-3"><BadgeStatut statut={s.statut} /></td>
                    <td className="px-5 lg:px-6 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectionne(s); }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Traiter →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAR_PAGE && (
            <div className="flex items-center justify-between px-5 lg:px-6 py-3 border-t border-slate-200 bg-slate-50/40 text-xs text-slate-600">
              <span>Page {page + 1} sur {Math.ceil(total / PAR_PAGE)} — {total.toLocaleString('fr-FR')} au total</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
                >
                  Précédente
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAR_PAGE >= total}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
                >
                  Suivante
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectionne && (
        <DrawerTraitement
          signalement={selectionne}
          onFermer={() => setSelectionne(null)}
          onMiseAJour={onMiseAJour}
        />
      )}
    </div>
  );
}

// --- Drawer latéral : détail + actions ---
function DrawerTraitement({
  signalement, onFermer, onMiseAJour,
}: {
  signalement: Signalement;
  onFermer: () => void;
  onMiseAJour: (s: Signalement) => void;
}) {
  const [note, setNote] = useState(signalement.note_interne ?? '');
  const [reponse, setReponse] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [infoReponse, setInfoReponse] = useState<string | null>(null);

  // Re-sync la note si on change de signalement sélectionné.
  useEffect(() => {
    setNote(signalement.note_interne ?? '');
    setReponse('');
    setErreur(null);
    setInfoReponse(null);
  }, [signalement.id]);

  async function patch(payload: { statut?: Statut; note_interne?: string | null }) {
    setErreur(null);
    const r = await fetch(`/api/admin-ui/signalements/${signalement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Erreur serveur');
    }
    return r.json() as Promise<Signalement>;
  }

  async function changerStatut(statut: Statut) {
    setEnCours(`statut:${statut}`);
    try {
      const s = await patch({ statut });
      onMiseAJour(s);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  async function enregistrerNote() {
    setEnCours('note');
    try {
      const s = await patch({ note_interne: note || null });
      onMiseAJour(s);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  async function envoyerReponse(e: FormEvent) {
    e.preventDefault();
    if (reponse.trim().length < 10) {
      setErreur('Le message doit faire au moins 10 caractères.');
      return;
    }
    setEnCours('reponse');
    setErreur(null);
    try {
      const r = await fetch(`/api/admin-ui/signalements/${signalement.id}/repondre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message: reponse }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || 'Erreur serveur');
      }
      // Recharge le détail pour refléter reponse_envoyee_a.
      const detail = await fetch(`/api/admin-ui/signalements/${signalement.id}`, { credentials: 'same-origin' });
      if (detail.ok) onMiseAJour(await detail.json());
      setReponse('');
      setInfoReponse(`Réponse envoyée à ${signalement.email}.`);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  const estFinal = signalement.statut === 'traite' || signalement.statut === 'rejete';

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={onFermer} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">Signalement #{signalement.id}</h3>
              <BadgeStatut statut={signalement.statut} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{formatDate(signalement.date_creation)}</p>
          </div>
          <button onClick={onFermer} className="text-slate-400 hover:text-slate-900 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-5">
          {/* Infos signaleur */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-20 shrink-0 pt-0.5">Signaleur</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">{signalement.nom_prenom}</div>
                <div className="text-xs text-slate-600">{signalement.email}</div>
                <div className="text-xs text-slate-500">{signalement.profession}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-20 shrink-0 pt-0.5">Type</span>
              <div className="text-sm text-slate-800">
                {signalement.type === 'correction' ? 'Correction de fiche existante' : 'Établissement manquant'}
                {signalement.type_probleme && ` — ${signalement.type_probleme}`}
              </div>
            </div>
            {signalement.etablissement_id && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-20 shrink-0 pt-0.5">Fiche</span>
                <div className="text-xs text-slate-700 font-mono">{signalement.etablissement_id}</div>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message</h4>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-wrap">
              {signalement.message}
            </div>
          </div>

          {/* Historique de traitement */}
          {(signalement.date_traitement || signalement.reponse_envoyee_a || signalement.traite_par_email) && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-xs text-slate-700">
              {signalement.traite_par_email && (
                <div><strong className="text-slate-900">Traité par :</strong> {signalement.traite_par_email}</div>
              )}
              {signalement.date_traitement && (
                <div><strong className="text-slate-900">Date de traitement :</strong> {formatDate(signalement.date_traitement)}</div>
              )}
              {signalement.reponse_envoyee_a && (
                <div><strong className="text-slate-900">Réponse envoyée :</strong> {formatDate(signalement.reponse_envoyee_a)}</div>
              )}
            </div>
          )}

          {/* Erreur */}
          {erreur && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800">{erreur}</p>
            </div>
          )}
          {infoReponse && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800">{infoReponse}</p>
            </div>
          )}

          {/* Actions statut */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Changer le statut</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => changerStatut('en_cours')}
                disabled={!!enCours || signalement.statut === 'en_cours'}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {enCours === 'statut:en_cours' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                En cours
              </button>
              <button
                onClick={() => changerStatut('nouveau')}
                disabled={!!enCours || signalement.statut === 'nouveau'}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {enCours === 'statut:nouveau' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                Rouvrir
              </button>
              <button
                onClick={() => changerStatut('traite')}
                disabled={!!enCours || signalement.statut === 'traite'}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {enCours === 'statut:traite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Marquer traité
              </button>
              <button
                onClick={() => changerStatut('rejete')}
                disabled={!!enCours || signalement.statut === 'rejete'}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {enCours === 'statut:rejete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Rejeter
              </button>
            </div>
            {estFinal && (
              <p className="mt-2 text-xs text-slate-500">
                Ce signalement est fermé. Vous pouvez le rouvrir si une info nouvelle arrive.
              </p>
            )}
          </div>

          {/* Note interne */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Note interne</h4>
              <span className="text-[10px] text-slate-400">Non visible du signaleur</span>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Décrire la décision, les vérifications faites, les suites à donner…"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-y"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={enregistrerNote}
                disabled={!!enCours || note === (signalement.note_interne ?? '')}
                className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {enCours === 'note' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enregistrer la note
              </button>
            </div>
          </div>

          {/* Réponse email */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <MailIcon className="w-3.5 h-3.5" />
                Répondre au signaleur
              </h4>
              <span className="text-[10px] text-slate-400">E-mail envoyé à {signalement.email}</span>
            </div>
            <form onSubmit={envoyerReponse}>
              <textarea
                value={reponse}
                onChange={e => setReponse(e.target.value)}
                rows={6}
                placeholder="Message pour le signaleur. Il recevra un e-mail estampillé Empower Doctor avec ce contenu."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-y"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">{reponse.length}/5000 caractères</span>
                <button
                  type="submit"
                  disabled={!!enCours || reponse.trim().length < 10}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {enCours === 'reponse' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer la réponse
                </button>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
