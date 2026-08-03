import 'dotenv/config';
import express from 'express';
import { pool } from './db';
import { getEtablissements, getPays, getSpecialites } from './queries';

const app = express();
const PORT = process.env.API_PORT || 4000;

app.get('/api/etablissements', async (_req, res) => {
  res.json(await getEtablissements(pool));
});

app.get('/api/pays', async (_req, res) => {
  res.json(await getPays(pool));
});

app.get('/api/specialites', async (_req, res) => {
  res.json(await getSpecialites(pool));
});

app.listen(PORT, () => console.log(`API prête sur http://localhost:${PORT}`));
