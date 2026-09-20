/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Flag, CheckCircle2, Loader2 } from 'lucide-react';
import { Etablissement } from '../types';
import { nomAffichage } from '../utils/nomAffichage';

const TYPES_PROBLEME: { value: string; label: string }[] = [
  { value: 'position', label: 'Position sur la carte' },
  { value: 'nom', label: 'Nom' },
  { value: 'adresse', label: 'Adresse' },
  { value: 'specialite', label: 'Spécialité' },
  { value: 'doublon', label: 'Doublon' },
  { value: 'ferme', label: 'Fermé / n\'existe plus' },
  { value: 'autre', label: 'Autre' },
];

const PROFESSIONS = ['Médecin ou praticien concerné', 'Patient / utilisateur', 'Autre professionnel de santé', 'Autre'];

interface SignalementModalProps {
  mode: 'correction' | 'absence';
  etablissement?: Etablissement | null;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignalementModal({ mode, etablissement, onClose }: SignalementModalProps) {
  const [typeProbleme, setTypeProbleme] = useState<string>('');
  const [typeProblemeAutre, setTypeProblemeAutre] = useState('');
  const [nomPrenom, setNomPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [professionAutre, setProfessionAutre] = useState('');
  const [message, setMessage] = useState('');
  const [siteWeb, setSiteWeb] = useState(''); // champ leurre anti-robot, jamais visible
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    premierChamp.current?.focus();
    const surEchap = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', surEchap);
    return () => document.removeEventListener('keydown', surEchap);
  }, [onClose]);

  const estCorrection = mode === 'correction';
  const professionFinale = profession === 'Autre' ? professionAutre.trim() : profession;

  const valider = (): string | null => {
    if (estCorrection && !typeProbleme) return 'Choisissez le type de problème.';
    if (estCorrection && typeProbleme === 'autre' && typeProblemeAutre.trim().length < 2) return 'Précisez le problème.';
    if (nomPrenom.trim().length < 2) return 'Indiquez votre nom et prénom.';
    if (email.trim() !== '' && !EMAIL_RE.test(email.trim())) return "L'adresse email n'est pas valide.";
    if (!profession) return 'Choisissez votre profession.';
    if (professionFinale.length < 2) return 'Précisez votre profession.';
    if (message.trim().length < 10) return 'Décrivez le problème en quelques mots (10 caractères minimum).';
    return null;
  };

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const problemeDeSaisie = valider();
    if (problemeDeSaisie) {
      setErreur(problemeDeSaisie);
      return;
    }
    setErreur(null);
    setEtat('envoi');
    try {
      const res = await fetch('/api/signalements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          etablissement_id: estCorrection ? etablissement?.id : undefined,
          type_probleme: estCorrection ? typeProbleme : undefined,
          type_probleme_precision: estCorrection && typeProbleme === 'autre' ? typeProblemeAutre : undefined,
          nom_prenom: nomPrenom,
          email: email.trim() || undefined,
          profession: professionFinale,
          message,
          site_web: siteWeb,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Impossible d'envoyer le signalement.");
      }
      setEtat('ok');
    } catch (err: any) {
      setErreur(err.message ?? "Impossible d'envoyer le signalement.");
      setEtat('saisie');
    }
  };

  const champ = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all';
  const etiquette = 'block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signalement-titre"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><Flag className="h-5 w-5" /></div>
            <div>
              <h2 id="signalement-titre" className="text-base font-black text-slate-900 leading-tight">
                {estCorrection ? 'Signaler une erreur' : 'Signaler un établissement manquant'}
              </h2>
              {estCorrection && etablissement && (
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {nomAffichage(etablissement.nom)} · {etablissement.categorie} · {etablissement.quartier || etablissement.arrondissement}, {etablissement.ville}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {etat === 'ok' ? (
          <div className="p-6 pt-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-slate-900 mb-1">Merci, signalement transmis</h3>
            <p className="text-sm text-slate-600 mb-5">
              Notre équipe va vérifier l'information et corriger la fiche si nécessaire.{email.trim() !== '' && " Nous pourrons vous recontacter à l'adresse indiquée."}
            </p>
            <button onClick={onClose} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors">Fermer</button>
          </div>
        ) : (
          <form onSubmit={envoyer} className="p-5 pt-2 flex flex-col gap-4" noValidate>
            {estCorrection && (
              <div>
                <label htmlFor="sig-type" className={etiquette}>Type de problème <span className="text-rose-500">*</span></label>
                <select id="sig-type" value={typeProbleme} onChange={(e) => setTypeProbleme(e.target.value)} className={`${champ} cursor-pointer`}>
                  <option value="">Choisir…</option>
                  {TYPES_PROBLEME.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {typeProbleme === 'autre' && (
                  <input type="text" aria-label="Précisez le problème" placeholder="Précisez le problème" maxLength={100} value={typeProblemeAutre} onChange={(e) => setTypeProblemeAutre(e.target.value)} className={`${champ} mt-2`} />
                )}
              </div>
            )}

            <div>
              <label htmlFor="sig-nom" className={etiquette}>Nom et prénom <span className="text-rose-500">*</span></label>
              <input id="sig-nom" ref={premierChamp} type="text" autoComplete="name" maxLength={120} value={nomPrenom} onChange={(e) => setNomPrenom(e.target.value)} className={champ} />
            </div>

            <div>
              <label htmlFor="sig-email" className={etiquette}>Email <span className="normal-case font-semibold tracking-normal text-slate-400">(facultatif — pour être recontacté)</span></label>
              <input id="sig-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
            </div>

            <div>
              <label htmlFor="sig-profession" className={etiquette}>Profession <span className="text-rose-500">*</span></label>
              <select id="sig-profession" value={profession} onChange={(e) => setProfession(e.target.value)} className={`${champ} cursor-pointer`}>
                <option value="">Choisir…</option>
                {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {profession === 'Autre' && (
                <input type="text" aria-label="Précisez votre profession" placeholder="Précisez votre profession" maxLength={80} value={professionAutre} onChange={(e) => setProfessionAutre(e.target.value)} className={`${champ} mt-2`} />
              )}
            </div>

            <div>
              <label htmlFor="sig-message" className={etiquette}>Message <span className="text-rose-500">*</span></label>
              <textarea
                id="sig-message"
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={estCorrection
                  ? "Ex. : le cabinet a déménagé, la vraie adresse est…"
                  : "Nom de l'établissement, spécialité, ville, adresse…"}
                className={`${champ} resize-y`}
              />
            </div>

            {/* Leurre anti-robot : hors écran, ignoré des humains et des lecteurs d'écran. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Ne pas remplir<input type="text" tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} /></label>
            </div>

            {erreur && <p role="alert" className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{erreur}</p>}

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Vos informations servent uniquement à vérifier ce signalement et, si vous avez laissé un email, à vous recontacter à son sujet. Elles ne sont jamais publiées.
            </p>

            <button
              type="submit"
              disabled={etat === 'envoi'}
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-black uppercase tracking-wider rounded-xl transition-colors"
            >
              {etat === 'envoi' ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : 'Envoyer le signalement'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
