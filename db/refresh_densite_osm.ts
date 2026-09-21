import 'dotenv/config';
import { Pool } from 'pg';
import { recupererHCP, recupererSurfaceOSM } from '../server/demographie';

// Recalcule surface_km2 (contour OpenStreetMap) et densite = population / surface pour chaque
// zone. La population doit déjà venir de HCP (db/refresh_demographie_hcp.ts). Sans --apply,
// affiche seulement les résultats. Une surface introuvable laisse la zone inchangée et signalée.
const appliquer = process.argv.includes('--apply');
// --zones=al-fida,agdal-riyad : limite le calcul à ces identifiants de zone.
const seulement = process.argv.find((a) => a.startsWith('--zones='))?.slice(8).split(',');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: zones } = await pool.query(
    `SELECT z.id, z.nom, v.nom AS ville, p.nom AS pays, z.population, z.densite, z.surface_km2
     FROM zones z JOIN villes v ON v.id = z.ville_id JOIN pays p ON p.id = v.pays_id ORDER BY v.nom, z.nom`
  ).then((res) => ({ rows: seulement ? res.rows.filter((z) => seulement.includes(z.id)) : res.rows }));
  const manquantes: string[] = [];
  for (const z of zones) {
    // Les API publiques (HCP, Nominatim, Overpass) coupent parfois la connexion : 3 essais par zone.
    let s: Awaited<ReturnType<typeof recupererSurfaceOSM>> = { km2: null, lat: null, lng: null, source: null };
    for (let essai = 0; essai < 3; essai++) {
      try {
        const hcp = await recupererHCP(z.ville, z.nom);
        s = await recupererSurfaceOSM(pool, z.nom, z.ville, z.pays, hcp.commune ? [hcp.commune] : []);
        break;
      } catch (e: any) {
        console.log(`  (essai ${essai + 1} échoué pour ${z.nom} : ${e?.cause?.code ?? e?.message})`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    await new Promise((r) => setTimeout(r, 1100)); // limite Nominatim : 1 requête/s
    if (!s.km2) { manquantes.push(`${z.ville}/${z.nom}`); console.log(`${z.ville}/${z.nom}: contour introuvable`); continue; }
    const densite = Math.round(Number(z.population) / s.km2);
    console.log(`${z.ville}/${z.nom}: pop ${z.population} | surface ${s.km2.toFixed(2)} km² | densité ${z.densite}→${densite} | ${s.source}`);
    if (appliquer) await pool.query('UPDATE zones SET surface_km2 = $2, densite = $3 WHERE id = $1', [z.id, s.km2.toFixed(3), densite]);
  }
  if (manquantes.length) console.log('Sans contour OSM :', manquantes.join(' ; '));
  await pool.end();
}
main();
