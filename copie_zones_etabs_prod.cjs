require('dotenv').config();
const { Client } = require('pg');

const VILLES = ['Fès', 'Rabat', 'Marrakech', 'Salé', 'Tanger'];

async function main() {
  const local = new Client({ connectionString: process.env.DATABASE_URL_LOCAL });
  const prod = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL_SESSION });
  await local.connect();
  await prod.connect();

  const zones = (await local.query(
    `SELECT z.id, z.ville_id, z.nom, z.lat, z.lng, z.population, z.prix_m2, z.loyer_m2, z.pop15_59, z.pop60_plus, z.densite, z.statut
     FROM zones z JOIN villes v ON v.id = z.ville_id WHERE v.nom = ANY($1)`,
    [VILLES]
  )).rows;

  const etabs = (await local.query(
    `SELECT id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, place_id, statut
     FROM etablissements WHERE ville = ANY($1)`,
    [VILLES]
  )).rows;

  console.log('Zones locales à copier:', zones.length);
  console.log('Établissements locaux à copier:', etabs.length);

  await prod.query('BEGIN');
  let zonesInserted = 0;
  let etabsInserted = 0;
  try {
    for (const z of zones) {
      const res = await prod.query(
        `INSERT INTO zones (id, ville_id, nom, lat, lng, population, prix_m2, loyer_m2, pop15_59, pop60_plus, densite, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [z.id, z.ville_id, z.nom, z.lat, z.lng, z.population, z.prix_m2, z.loyer_m2, z.pop15_59, z.pop60_plus, z.densite, z.statut]
      );
      zonesInserted += res.rowCount;
    }
    for (const e of etabs) {
      const res = await prod.query(
        `INSERT INTO etablissements (id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, place_id, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.nom, e.categorie, e.ville, e.quartier, e.arrondissement, e.adresse, e.latitude, e.longitude, e.source, e.place_id, e.statut]
      );
      etabsInserted += res.rowCount;
    }
    await prod.query('COMMIT');
    console.log('Zones insérées:', zonesInserted, '/ ignorées (déjà présentes):', zones.length - zonesInserted);
    console.log('Établissements insérés:', etabsInserted, '/ ignorés (déjà présents):', etabs.length - etabsInserted);
  } catch (err) {
    await prod.query('ROLLBACK');
    console.error('ERREUR, rollback:', err.message);
    throw err;
  } finally {
    await local.end();
    await prod.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
