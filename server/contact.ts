// Formulaire de contact du site vitrine. Expose une seule fonction `envoyerContact` partagée
// entre le handler Vercel (api/contact.ts) et le serveur Express de dev (server/index.ts), pour
// que le comportement soit identique. Pas de persistance en base — l'e-mail est l'archive.
//
// Rate limit par IP : fenêtre glissante in-memory. Même limite que l'ancien RateLimit, mais ici
// 5 envois/15 min (le formulaire est public, pas authentifié). Les instances serverless froides
// Vercel peuvent faire perdre le compteur — c'est un bug mineur ici, un attaquant qui en profite
// enverra au plus quelques dizaines d'e-mails avant que l'adresse soit refusée côté Resend. Pour
// une vraie protection, mettre le firewall edge devant /api/contact dans le dashboard Vercel.

import { envoyerEmail, emailContactVitrine } from './email.js';
import { RateLimit } from './rateLimit.js';

export class ErreurContact extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOM_MIN = 2, NOM_MAX = 120;
const SUJET_MAX = 200;
const MESSAGE_MIN = 10, MESSAGE_MAX = 3000;

export const contactRateLimit = new RateLimit(5, 15 * 60 * 1000, 'contact');

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

export async function envoyerContact(body: unknown, ip: string): Promise<void> {
  const limite = contactRateLimit.verifier(ip);
  if (!limite.ok) {
    throw new ErreurContact(429, `Trop d'envois — réessayez dans ${Math.ceil((limite.secondsRestantes ?? 60) / 60)} minute(s).`);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const nom = clean(b.nom, NOM_MAX);
  const email = clean(b.email, 254).toLowerCase();
  const sujet = clean(b.sujet, SUJET_MAX);
  const message = clean(b.message, MESSAGE_MAX);

  if (nom.length < NOM_MIN) throw new ErreurContact(400, 'Nom trop court.');
  if (!EMAIL_RE.test(email)) throw new ErreurContact(400, 'E-mail invalide.');
  if (message.length < MESSAGE_MIN) throw new ErreurContact(400, 'Message trop court.');

  // Honeypot (facultatif) : si un bot remplit un champ caché, on simule le succès pour ne pas lui
  // signaler qu'il a été détecté — en pratique les bots dégagent sans réessayer.
  if (typeof b.site === 'string' && b.site.length > 0) return;

  const destinataire = process.env.CONTACT_RECIPIENT_EMAIL || 'abderrahmane.elbaghdadi@cfconsulting.ma';
  const { sujet: s, html, texte } = emailContactVitrine(nom, email, sujet, message);
  await envoyerEmail(destinataire, s, html, texte, { replyTo: email });

  console.log(`[contact] message envoyé — de=${email} vers=${destinataire} longueur_msg=${message.length}`);
}
