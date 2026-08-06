import 'dotenv/config';
import express from 'express';
import { pool } from './db';
import { getEtablissements, getPays, getSpecialites } from './queries';
import { extraireEtInserer } from './extraction';
import { extraireEtInsererZone } from './demographie';

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(express.json());

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
app.post('/api/admin/extraction', async (req, res) => {
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
app.post('/api/admin/extraction-zone', async (req, res) => {
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

app.listen(PORT, () => console.log(`API prête sur http://localhost:${PORT}`));
