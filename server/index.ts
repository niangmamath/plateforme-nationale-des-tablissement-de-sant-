import 'dotenv/config';
import express from 'express';
import { pool } from './db';
import { getEtablissements, getPays, getSpecialites } from './queries';
import { extraireEtInserer } from './extraction';
import { extraireEtInsererZone } from './demographie';
import { repondre, ErreurChat, type MessageChat } from './chat';
import { enregistrerSignalement, extraireIp, ErreurSignalement } from './signalements';

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

app.listen(PORT, () => console.log(`API prête sur http://localhost:${PORT}`));
