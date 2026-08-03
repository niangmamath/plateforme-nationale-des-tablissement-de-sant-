import 'dotenv/config';
import { Client } from 'pg';

// Maroc : valeurs déjà présentes dans le code (SANTE_DATA_DICTIONARY / ARRONDISSEMENTS_DEMO de
// StatsDashboard.tsx, identiques dans les deux), simplement déplacées en base — aucune valeur
// inventée ici. Le prix/m² utilisé partout (y compris l'onglet Démographie) reste "prix_m2"
// (déjà en base, sourcé de maroc.ts) ; ARRONDISSEMENTS_DEMO avait sa propre valeur de prix/m²
// mais elle n'est plus utilisée nulle part.
const MAROC_DEMO: Record<string, { pop15_59: number; pop60_plus: number; densite: number }> = {
  anfa: { pop15_59: 58.90, pop60_plus: 14.70, densite: 10000 },
  maarif: { pop15_59: 61.20, pop60_plus: 21.00, densite: 14166 },
  'hay-hassani': { pop15_59: 64.30, pop60_plus: 29.60, densite: 13133 },
  'sidi-belyout': { pop15_59: 59.70, pop60_plus: 16.40, densite: 13846 },
  'ain-chock': { pop15_59: 63.00, pop60_plus: 23.70, densite: 12500 },
  'ain-sebaa': { pop15_59: 62.50, pop60_plus: 23.50, densite: 15625 },
  'sidi-moumen': { pop15_59: 63.30, pop60_plus: 24.80, densite: 21010 },
  'sidi-bernoussi': { pop15_59: 62.00, pop60_plus: 22.20, densite: 12020 },
  'roches-noires': { pop15_59: 61.60, pop60_plus: 21.50, densite: 14581 },
  'moulay-rachid': { pop15_59: 62.20, pop60_plus: 23.40, densite: 22932 },
  sbata: { pop15_59: 60.90, pop60_plus: 18.20, densite: 22237 },
  'mers-sultan': { pop15_59: 58.90, pop60_plus: 13.90, densite: 26502 },
  'al-fida': { pop15_59: 59.10, pop60_plus: 15.80, densite: 33186 },
  'ben-msick': { pop15_59: 60.00, pop60_plus: 17.40, densite: 33938 },
  'sidi-othmane': { pop15_59: 61.10, pop60_plus: 20.10, densite: 26257 },
  'hay-mohammadi': { pop15_59: 59.90, pop60_plus: 17.00, densite: 24794 },
  agdal: { pop15_59: 61.90, pop60_plus: 23.70, densite: 7200 },
  saiss: { pop15_59: 60.30, pop60_plus: 14.40, densite: 6666 },
  zouagha: { pop15_59: 59.10, pop60_plus: 10.80, densite: 10400 },
  'mechouar-fes-jdid': { pop15_59: 61.80, pop60_plus: 19.80, densite: 11666 },
};

// Sénégal : aucune donnée par quartier n'existait dans le code. pop15_59/pop60_plus sont une
// ESTIMATION dérivée de la structure par âge nationale ANSD 2023 (15-64 ans: 57.1%, 65+: 3.8%),
// pas une vraie donnée par quartier — à corriger si des chiffres ANSD plus précis sont trouvés.
// densite calculée à partir de superficies réelles (RGPHAE/ANSD) quand disponibles ;
// almadies/point-e sont des estimations grossières (pas de découpage ANSD correspondant exactement).
const SENEGAL_DEMO: Record<string, { pop15_59: number; pop60_plus: number; densite: number }> = {
  plateau: { pop15_59: 52.0, pop60_plus: 9.0, densite: 8000 },   // 40000 hab. / 5 km² (Dakar-Plateau, ANSD)
  mermoz: { pop15_59: 52.0, pop60_plus: 9.0, densite: 13333 },   // 80000 hab. / 6 km² (Mermoz-Sacré-Cœur, ANSD)
  almadies: { pop15_59: 52.0, pop60_plus: 9.0, densite: 7500 },  // estimation grossière
  'point-e': { pop15_59: 52.0, pop60_plus: 9.0, densite: 16667 }, // estimation grossière
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const all = { ...MAROC_DEMO, ...SENEGAL_DEMO };
  let updated = 0;
  for (const [id, vals] of Object.entries(all)) {
    const { rowCount } = await client.query(
      'UPDATE zones SET pop15_59 = $1, pop60_plus = $2, densite = $3 WHERE id = $4',
      [vals.pop15_59, vals.pop60_plus, vals.densite, id]
    );
    updated += rowCount ?? 0;
  }

  console.log(`Zones mises à jour : ${updated}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
