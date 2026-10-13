// Onglet "Messages" : fil commun entre admins, type canal Slack.
// - Polling toutes les 5s quand l'onglet est actif (pas de WebSocket, overkill à 2-5 personnes).
// - Marquage automatique "lu" quand l'onglet est ouvert.
// - Suppression possible par l'auteur dans les 15 min (règle serveur).
// - Hook useBadgeMessages exporté pour afficher un badge sur l'onglet depuis AdminDashboard.

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import { Send, Loader2, MessageSquare, AlertCircle, Trash2 } from 'lucide-react';

interface Message {
  id: number;
  auteur_id: number | null;
  auteur_email: string | null;
  contenu: string;
  date_envoi: string;
  est_moi: boolean;
}

interface ReponseListe {
  messages: Message[];
  dernier_id: number;
  non_lus: number;
}

const INTERVAL_POLL_MS = 5000;
const INTERVAL_BADGE_MS = 20000;

function formatHeure(iso: string): string {
  const d = new Date(iso);
  const maintenant = new Date();
  const sameDay = d.toDateString() === maintenant.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((maintenant.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return `Hier ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function initialesEmail(email: string | null): string {
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

// Palette déterministe pour les avatars des autres admins (couleurs par email).
function couleurAvatar(email: string | null): string {
  if (!email) return 'bg-slate-400';
  const palette = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-teal-500'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

export function TabMessages({ moiEmail }: { moiEmail: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const refConteneur = useRef<HTMLDivElement>(null);
  const refDernierId = useRef<number>(0);

  const scrollEnBas = useCallback(() => {
    if (refConteneur.current) {
      refConteneur.current.scrollTop = refConteneur.current.scrollHeight;
    }
  }, []);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    try {
      const r = await fetch('/api/admin-ui/messages', { credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur serveur');
      const d: ReponseListe = await r.json();
      setMessages(d.messages);
      // Marquer "lu" uniquement si l'onglet est actif et qu'il y a du nouveau.
      if (d.dernier_id > refDernierId.current) {
        refDernierId.current = d.dernier_id;
        await fetch('/api/admin-ui/messages/lu', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ dernier_id: d.dernier_id }),
        }).catch(() => {});
      }
      setErreur(null);
    } catch (e: any) {
      if (!silencieux) setErreur(e.message);
    } finally {
      if (!silencieux) setChargement(false);
    }
  }, []);

  // Charge au montage + polling 5s.
  useEffect(() => {
    charger();
    const timer = setInterval(() => charger(true), INTERVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [charger]);

  // Scroll en bas après chaque mise à jour de la liste (nouveau message reçu ou envoyé).
  useEffect(() => { scrollEnBas(); }, [messages, scrollEnBas]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!brouillon.trim() || envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const r = await fetch('/api/admin-ui/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ contenu: brouillon.trim() }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Envoi impossible');
      const nouveau: Message = await r.json();
      setMessages(prev => [...prev, nouveau]);
      refDernierId.current = Math.max(refDernierId.current, nouveau.id);
      setBrouillon('');
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function supprimer(id: number) {
    if (!confirm('Supprimer ce message ? (possible pendant 15 min après envoi)')) return;
    const r = await fetch(`/api/admin-ui/messages/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (r.ok) {
      setMessages(prev => prev.filter(m => m.id !== id));
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'Suppression impossible.');
    }
  }

  // Peut-on supprimer ? Dans les 15 min, par l'auteur.
  const peutSupprimer = (m: Message) =>
    m.est_moi && (Date.now() - new Date(m.date_envoi).getTime()) < 15 * 60 * 1000;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: 500 }}>
      <div className="px-5 lg:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Messagerie interne</h3>
          <p className="text-xs text-slate-500">Fil commun entre les administrateurs d'Empower Doctor</p>
        </div>
      </div>

      <div ref={refConteneur} className="flex-1 overflow-y-auto px-5 lg:px-6 py-4 bg-slate-50/40">
        {chargement && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Chargement…</span>
          </div>
        )}
        {!chargement && messages.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-500">
            Aucun message pour l'instant. Écrivez le premier ci-dessous.
          </div>
        )}
        {messages.map((m, i) => {
          // On regroupe les messages consécutifs d'un même auteur (avatar + nom affichés sur le 1er).
          const prec = messages[i - 1];
          const memeAuteurQuePrec = prec && prec.auteur_id === m.auteur_id &&
            (new Date(m.date_envoi).getTime() - new Date(prec.date_envoi).getTime()) < 5 * 60 * 1000;

          const afficheurEmail = m.auteur_email ?? '(compte supprimé)';
          const estMoi = m.est_moi;

          return (
            <div key={m.id} className={`flex gap-3 ${memeAuteurQuePrec ? 'mt-0.5' : 'mt-4'} ${estMoi ? 'flex-row-reverse' : ''}`}>
              {memeAuteurQuePrec ? (
                <div className="w-8 shrink-0" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${estMoi ? 'bg-gradient-to-br from-blue-500 to-indigo-700' : couleurAvatar(afficheurEmail)}`}>
                  {initialesEmail(afficheurEmail)}
                </div>
              )}
              <div className={`min-w-0 max-w-[75%] ${estMoi ? 'items-end' : 'items-start'} flex flex-col`}>
                {!memeAuteurQuePrec && (
                  <div className={`flex items-baseline gap-2 text-xs mb-1 ${estMoi ? 'flex-row-reverse' : ''}`}>
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                      {estMoi ? 'Vous' : afficheurEmail}
                    </span>
                    <span className="text-slate-400">{formatHeure(m.date_envoi)}</span>
                  </div>
                )}
                <div className="group relative">
                  <div className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    estMoi
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  }`}>
                    {m.contenu}
                  </div>
                  {peutSupprimer(m) && (
                    <button
                      onClick={() => supprimer(m.id)}
                      className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-full p-1 shadow-sm hover:bg-rose-50 hover:border-rose-200"
                      title="Supprimer (possible pendant 15 min)"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {erreur && (
        <div className="flex items-start gap-2 bg-rose-50 border-t border-rose-200 px-4 py-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800">{erreur}</p>
        </div>
      )}

      <form onSubmit={envoyer} className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={brouillon}
            onChange={e => setBrouillon(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                envoyer(e as unknown as FormEvent);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Écrire un message en tant que ${moiEmail}… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)`}
            className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none max-h-[120px]"
          />
          <button
            type="submit"
            disabled={!brouillon.trim() || envoiEnCours}
            className="inline-flex items-center justify-center gap-1.5 w-11 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
            title="Envoyer"
          >
            {envoiEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// Hook pour afficher le badge "N nouveaux" sur l'onglet Messages, utilisé depuis AdminDashboard.
// Fait un polling léger (seulement un compteur) toutes les 20s. Quand l'onglet est actif, le badge
// est tenu à 0 — c'est le composant TabMessages qui marque "lu".
export function useBadgeMessages(ongletActif: boolean): number {
  const [nonLus, setNonLus] = useState(0);

  useEffect(() => {
    if (ongletActif) {
      setNonLus(0);
      return;
    }
    let actif = true;
    const charger = async () => {
      try {
        const r = await fetch('/api/admin-ui/messages/non-lus', { credentials: 'same-origin' });
        if (!r.ok) return;
        const d: { non_lus: number } = await r.json();
        if (actif) setNonLus(d.non_lus);
      } catch { /* silencieux */ }
    };
    charger();
    const timer = setInterval(charger, INTERVAL_BADGE_MS);
    return () => { actif = false; clearInterval(timer); };
  }, [ongletActif]);

  return nonLus;
}
