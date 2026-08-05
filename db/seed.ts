import 'dotenv/config';
import { Client } from 'pg';
import { AVAILABLE_COUNTRIES } from '../src/data';
import { ESTABLISHMENTS_DATA } from '../src/data/etablissements';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query('BEGIN');
  try {
    await client.query('TRUNCATE etablissements, zones, villes, pays RESTART IDENTITY CASCADE');

    for (const pays of AVAILABLE_COUNTRIES) {
      await client.query(
        'INSERT INTO pays (id, nom, devise) VALUES ($1, $2, $3)',
        [pays.id, pays.nom, pays.devise]
      );

      for (const ville of pays.villes) {
        await client.query(
          'INSERT INTO villes (id, pays_id, nom, lat, lng, zoom_base) VALUES ($1, $2, $3, $4, $5, $6)',
          [ville.id, pays.id, ville.nom, ville.lat, ville.lng, ville.zoomBase]
        );

        for (const zone of ville.zones) {
          await client.query(
            'INSERT INTO zones (id, ville_id, nom, lat, lng, population, prix_m2, loyer_m2) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [zone.id, ville.id, zone.nom, zone.lat, zone.lng, zone.population, zone.prixM2, zone.loyerM2]
          );
        }
      }
    }

    for (const etab of ESTABLISHMENTS_DATA) {
      // location (PostGIS) est calculée automatiquement par un trigger à partir de latitude/longitude
      await client.query(
        `INSERT INTO etablissements (id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, place_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          etab.id, etab.nom, etab.categorie, etab.ville, etab.quartier,
          etab.arrondissement ?? null, etab.adresse, etab.latitude, etab.longitude,
          etab.source, etab.placeId,
        ]
      );
    }

    // Données de référence, pas du contenu à valider manuellement (statut par défaut
    // "brouillon" depuis la migration 009) : on publie directement.
    await client.query("UPDATE pays SET statut = 'publie'");
    await client.query("UPDATE villes SET statut = 'publie'");
    await client.query("UPDATE zones SET statut = 'publie'");
    await client.query("UPDATE etablissements SET statut = 'publie'");

    await client.query('COMMIT');
    console.log(`Seed OK : ${AVAILABLE_COUNTRIES.length} pays, ${ESTABLISHMENTS_DATA.length} établissements.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
