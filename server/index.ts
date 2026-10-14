import 'dotenv/config';
import express from 'express';
import { pool } from './db';
import { getEtablissements, getPays, getSpecialites } from './queries';
import { extraireEtInserer } from './extraction';
import { extraireEtInsererZone } from './demographie';
import { repondre, ErreurChat, type MessageChat } from './chat';
import { enregistrerSignalement, extraireIp, ErreurSignalement } from './signalements';
import {
  inscrire, connecter, connecterAvecGoogle, creerJeton, cookieSession, cookieDeconnexion, utilisateurDepuisCookies, ErreurAuth,
  verifierEmail, renvoyerCodeVerification, demanderReinitialisationMotDePasse, reinitialiserMotDePasse,
} from './auth';
import { sauvegarderBrouillon, recupererBrouillon, ErreurBrouillon } from './businessPlanDrafts';
import { seedFondateurs } from './adminAuth';
import { routerAdmin } from './adminRouter';
import { ipDeRequete } from './rateLimit';

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(express.json());

// Même garde que côté Vercel (api/admin/*.ts) : sans elle, ces routes déclenchent une
// extraction (coût API Google, écritures en base) pour quiconque atteint ce serveur —
// et `vite --host=0.0.0.0` l'expose au-delà de la seule machine locale.
function verifierSecretAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.ADMIN_EXTRACTION_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    res.status(401).json({ error: 'Non autorisé.' });
    return;
  }
  next();
}

app.get('/api/etablissements', async (_req, res) => {
  res.json(await getEtablissements(pool));
});

app.get('/api/pays', async (_req, res) => {
  res.json(await getPays(pool));
});

app.get('/api/specialites', async (_req, res) => {
  res.json(await getSpecialites(pool));
});

// Déclenché par le Flow Directus (formulaire pays/ville/spécialité) — extrait, nettoie,
// dédoublonne et insère les nouveaux établissements en statut "brouillon".
app.post('/api/admin/extraction', verifierSecretAdmin, async (req, res) => {
  const { pays, ville, specialite } = req.body ?? {};
  if (!pays || !ville || !specialite) {
    res.status(400).json({ error: 'Paramètres requis : pays, ville, specialite.' });
    return;
  }

  try {
    const resultat = await extraireEtInserer(pool, specialite, pays, ville);
    res.json(resultat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Déclenché par le Flow Directus (formulaire pays/ville/zone) — récupère population, pop15-59,
// pop60+, densité (HCP + OpenStreetMap) et prix_m2 (Yakeey) pour une nouvelle zone, crée la
// ville si besoin, refuse une zone déjà enregistrée, et insère en statut "brouillon".
app.post('/api/admin/extraction-zone', verifierSecretAdmin, async (req, res) => {
  const { pays, ville, zone } = req.body ?? {};
  if (!pays || !ville || !zone) {
    res.status(400).json({ error: 'Paramètres requis : pays, ville, zone.' });
    return;
  }

  try {
    const resultat = await extraireEtInsererZone(pool, pays, ville, zone);
    res.json(resultat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Assistant du chatbot (widget flottant) — mêmes données réelles (démographie, spécialités,
// concurrence) que l'app, injectées dans le contexte du modèle plutôt que servies telles quelles.
app.post('/api/chat', async (req, res) => {
  const { messages } = (req.body ?? {}) as { messages?: MessageChat[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Paramètre requis : messages (tableau non vide).' });
    return;
  }

  try {
    const text = await repondre(pool, { openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY }, messages);
    res.json({ text });
  } catch (err: any) {
    if (err instanceof ErreurChat) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/chat :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

// Formulaire de contact du site vitrine. Rate limit par IP + validation dans server/contact.ts.
app.post('/api/contact', async (req, res) => {
  try {
    const { envoyerContact, ErreurContact } = await import('./contact.js');
    await envoyerContact(req.body, extraireIp(req.headers['x-forwarded-for'], req.ip));
    res.status(200).json({ ok: true });
  } catch (err: any) {
    if (err && err.constructor && err.constructor.name === 'ErreurContact') {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/contact :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

// Signalement utilisateur (correction d'une fiche ou établissement manquant) — endpoint public
// en écriture : validation stricte + limite de fréquence par IP dans server/signalements.ts.
app.post('/api/signalements', async (req, res) => {
  try {
    await enregistrerSignalement(pool, req.body, extraireIp(req.headers['x-forwarded-for'], req.ip));
    res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err instanceof ErreurSignalement) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/signalements :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

// Comptes utilisateur (nécessaires pour sauvegarder/restaurer un brouillon de business plan —
// voir server/auth.ts). Un seul chemin /api/auth (GET = utilisateur courant, POST dispatch sur
// body.action) plutôt que 5 routes séparées, pour rester en miroir exact de api/auth.ts côté
// Vercel (regroupé là-bas pour rester sous la limite de 12 fonctions serverless du plan Hobby).
app.get('/api/auth', (req, res) => {
  const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
  if (!utilisateur) {
    res.status(401).json({ error: 'Non connecté.' });
    return;
  }
  res.status(200).json(utilisateur);
});

app.post('/api/auth', async (req, res) => {
  const { action } = req.body ?? {};
  try {
    switch (action) {
      case 'signup': {
        // Volontairement pas de session ici : s'inscrire ne doit pas donner accès directement,
        // l'utilisateur doit ensuite se connecter explicitement (voir action 'login').
        const { email, password } = req.body;
        const utilisateur = await inscrire(pool, email, password);
        res.status(201).json(utilisateur);
        return;
      }
      case 'login': {
        const { email, password } = req.body;
        const utilisateur = await connecter(pool, email, password);
        res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
        res.status(200).json(utilisateur);
        return;
      }
      case 'google': {
        const { idToken } = req.body;
        const utilisateur = await connecterAvecGoogle(pool, idToken);
        res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
        res.status(200).json(utilisateur);
        return;
      }
      case 'logout': {
        res.setHeader('Set-Cookie', cookieDeconnexion());
        res.status(200).json({ ok: true });
        return;
      }
      case 'verify-email': {
        const { email, code } = req.body;
        await verifierEmail(pool, email, code);
        res.status(200).json({ ok: true });
        return;
      }
      case 'resend-verification': {
        const { email } = req.body;
        await renvoyerCodeVerification(pool, email);
        res.status(200).json({ ok: true });
        return;
      }
      case 'forgot-password': {
        const { email } = req.body;
        await demanderReinitialisationMotDePasse(pool, email);
        res.status(200).json({ ok: true, message: 'Si un compte existe avec cette adresse, un code vient de lui être envoyé.' });
        return;
      }
      case 'reset-password': {
        const { email, code, password } = req.body;
        await reinitialiserMotDePasse(pool, email, code, password);
        res.status(200).json({ ok: true });
        return;
      }
      default:
        res.status(400).json({ error: 'Action inconnue.' });
    }
  } catch (err: any) {
    if (err instanceof ErreurAuth) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/auth :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

// Brouillon de business plan (un par utilisateur/zone/spécialité) — voir server/businessPlanDrafts.ts.
app.get('/api/business-plan-draft', async (req, res) => {
  const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
  if (!utilisateur) {
    res.status(401).json({ error: 'Non connecté.' });
    return;
  }
  try {
    const { zoneId, specialiteId } = req.query;
    const brouillon = await recupererBrouillon(pool, utilisateur.id, zoneId, specialiteId);
    res.status(200).json(brouillon);
  } catch (err: any) {
    if (err instanceof ErreurBrouillon) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur GET /api/business-plan-draft :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

app.post('/api/business-plan-draft', async (req, res) => {
  const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
  if (!utilisateur) {
    res.status(401).json({ error: 'Non connecté.' });
    return;
  }
  try {
    const { zoneId, specialiteId, data } = req.body ?? {};
    await sauvegarderBrouillon(pool, utilisateur.id, zoneId, specialiteId, data);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    if (err instanceof ErreurBrouillon) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur POST /api/business-plan-draft :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
});

// Routeur du dashboard admin interne : toutes les sous-routes /api/admin-ui/* sont dispatchées
// vers un même module partagé (server/adminRouter.ts), réutilisé tel quel côté Vercel dans
// api/admin-ui.ts. Un seul préfixe plutôt qu'un app.post par route : les ajouts/retraits ne
// touchent que adminRouter.ts, pas ce fichier. Et on reste indépendant de /api/admin/* (secret
// partagé pour les Directus Flows), qui reste intact.
app.all('/api/admin-ui/*', async (req, res) => {
  const sousPath = req.path.replace(/^\/api\/admin-ui/, '') || '/';
  const result = await routerAdmin(pool, {
    method: req.method,
    cookieHeader: req.headers.cookie,
    body: req.body,
    query: req.query as Record<string, string | string[] | undefined>,
    path: sousPath,
    ip: ipDeRequete(req.headers['x-forwarded-for'], req.ip),
  });
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  res.status(result.status).json(result.body);
});

// --- Checks au boot ---
// Fail-fast si une variable critique manque OU si deux secrets JWT partagent la même valeur
// (sinon un cookie médecin modifié avec `role` ajouté pourrait tromper le vérificateur admin).
function checksBoot(): void {
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error('[boot] ADMIN_SESSION_SECRET manquant — le login admin échouera. Définir dans .env.');
  }
  if (!process.env.SESSION_SECRET) {
    console.error('[boot] SESSION_SECRET manquant — le login utilisateur échouera. Définir dans .env.');
  }
  if (process.env.ADMIN_SESSION_SECRET && process.env.SESSION_SECRET
      && process.env.ADMIN_SESSION_SECRET === process.env.SESSION_SECRET) {
    throw new Error('[boot] ADMIN_SESSION_SECRET et SESSION_SECRET ne doivent PAS avoir la même valeur (risque de confusion de rôle).');
  }
}
checksBoot();

// Seed des comptes fondateurs (ADMIN_FOUNDER_EMAILS + ADMIN_FOUNDER_PASSWORD_N) au démarrage.
// Idempotent : si les comptes existent déjà avec leur hash, aucun écrit en base. Les mdp en
// clair ne quittent jamais la mémoire de ce process.
seedFondateurs(pool).catch(err => console.error('[admin] Erreur seed fondateurs :', err));

app.listen(PORT, () => console.log(`API prête sur http://localhost:${PORT}`));
