import 'dotenv/config';
import { Client } from 'pg';
import { DERMATO_CONFIG, OPHTALMO_CONFIG, CLINIQUE_CONFIG } from '../src/config/specialities';

// Poids/labels/couleur/cible : repris tels quels de ScoringSection.tsx (handleSelectSpecialty /
// getLabels) et specialties.ts (cibleKey/cibleLabel), qui divergeaient légèrement entre eux.
// Cette table devient la source unique — ScoringSection devra être branché dessus ensuite.
// Poids des 6 critères communs : valeurs reprises de la migration 013_specialites_pop60plus.sql
// (dernière harmonisation en date), seule source de vérité pour ces valeurs.
const SPECIALITES = [
  {
    id: 'Dermatologie',
    nom: 'Dermatologie',
    couleur: 'blue',
    cibleKey: 'pop15_59',
    cibleLabel: 'Actifs & Jeunes (15-59 ans)',
    poids: { prix: 35, population: 10, densite: 5, pop1559: 25, pop60plus: 10, concurrence: 15 },
    config: DERMATO_CONFIG,
  },
  {
    id: 'Ophtalmologie',
    nom: 'Ophtalmologie',
    couleur: 'emerald',
    cibleKey: 'pop60_plus',
    cibleLabel: 'Seniors (60+ ans)',
    poids: { prix: 10, population: 15, densite: 5, pop1559: 10, pop60plus: 35, concurrence: 25 },
    config: OPHTALMO_CONFIG,
  },
  {
    id: 'Clinique',
    nom: 'Clinique Privée',
    couleur: 'purple',
    cibleKey: null,
    cibleLabel: null,
    poids: { prix: 20, population: 30, densite: 15, pop1559: 10, pop60plus: 10, concurrence: 15 },
    config: CLINIQUE_CONFIG,
  },
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query('BEGIN');
  try {
    await client.query(
      'TRUNCATE specialite_actes, specialite_machines, specialite_effectifs, specialite_amenagements, specialites RESTART IDENTITY CASCADE'
    );

    for (const s of SPECIALITES) {
      const cfg: any = s.config;
      await client.query(
        `INSERT INTO specialites
          (id, nom, couleur, titre_business_plan, specialite_nom_bp, cible_key, cible_label,
           poids_prix, poids_population, poids_densite, poids_pop1559, poids_pop60plus, poids_concurrence,
           frais_preliminaires, surface_defaut, bfr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          s.id, s.nom, s.couleur, cfg.titre, cfg.specialiteNom, s.cibleKey, s.cibleLabel,
          s.poids.prix, s.poids.population, s.poids.densite, s.poids.pop1559, s.poids.pop60plus, s.poids.concurrence,
          cfg.fraisPreliminaires ?? 5000, cfg.surfaceDefaut ?? 80, cfg.bfr ?? 25000,
        ]
      );

      for (const [i, a] of cfg.amenagements.entries()) {
        await client.query(
          'INSERT INTO specialite_amenagements (specialite_id, nom, prix, ordre) VALUES ($1,$2,$3,$4)',
          [s.id, a.nom, a.prix, i]
        );
      }
      for (const [i, e] of cfg.effectifs.entries()) {
        await client.query(
          'INSERT INTO specialite_effectifs (specialite_id, nom, qte, salaire, ordre) VALUES ($1,$2,$3,$4,$5)',
          [s.id, e.nom, e.qte, e.salaire, i]
        );
      }
      for (const [i, m] of cfg.machines.entries()) {
        await client.query(
          'INSERT INTO specialite_machines (specialite_id, nom, prix, ordre) VALUES ($1,$2,$3,$4)',
          [s.id, m.nom, m.prix, i]
        );
      }
      for (const [i, a] of cfg.actes.entries()) {
        await client.query(
          'INSERT INTO specialite_actes (specialite_id, type, nom, nbr_jour, prix_unitaire, ordre) VALUES ($1,$2,$3,$4,$5,$6)',
          [s.id, a.type ?? null, a.nom, a.nbrJour, a.prixUnitaire, i]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seed spécialités OK : ${SPECIALITES.length} spécialités.`);
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
