import { Pool } from 'pg';

export async function getEtablissements(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT id, nom, categorie, ville, quartier, arrondissement, adresse,
           latitude, longitude,
           source, place_id AS "placeId"
    FROM etablissements
    WHERE statut = 'publie'
    ORDER BY id
  `);
  return rows;
}

export async function getPays(pool: Pool) {
  const { rows: paysRows } = await pool.query("SELECT id, nom, devise FROM pays WHERE statut = 'publie' ORDER BY id");
  const { rows: villeRows } = await pool.query(
    `SELECT id, pays_id AS "paysId", nom, lat, lng, zoom_base AS "zoomBase"
     FROM villes WHERE statut = 'publie' ORDER BY id`
  );
  const { rows: zoneRows } = await pool.query(
    `SELECT id, ville_id AS "villeId", nom, lat, lng, population,
            prix_m2 AS "prixM2", loyer_m2 AS "loyerM2",
            pop15_59 AS "pop15_59", pop60_plus AS "pop60_plus", densite
     FROM zones WHERE statut = 'publie' ORDER BY id`
  );

  return paysRows.map((p) => ({
    ...p,
    villes: villeRows
      .filter((v) => v.paysId === p.id)
      .map(({ paysId, ...v }) => ({
        ...v,
        zones: zoneRows
          .filter((z) => z.villeId === v.id)
          .map(({ villeId, ...z }) => ({
            ...z,
            prixM2: Number(z.prixM2),
            loyerM2: Number(z.loyerM2),
            pop15_59: z.pop15_59 !== null ? Number(z.pop15_59) : null,
            pop60_plus: z.pop60_plus !== null ? Number(z.pop60_plus) : null,
            densite: z.densite !== null ? Number(z.densite) : null,
          })),
      })),
  }));
}

export async function getSpecialites(pool: Pool) {
  const { rows: specs } = await pool.query("SELECT * FROM specialites WHERE statut = 'publie' ORDER BY id");
  const { rows: amenagements } = await pool.query(
    `SELECT id, specialite_id AS "specialiteId", nom, prix
     FROM specialite_amenagements WHERE statut = 'publie' ORDER BY specialite_id, ordre`
  );
  const { rows: effectifs } = await pool.query(
    `SELECT id, specialite_id AS "specialiteId", nom, qte, salaire
     FROM specialite_effectifs WHERE statut = 'publie' ORDER BY specialite_id, ordre`
  );
  const { rows: machines } = await pool.query(
    `SELECT id, specialite_id AS "specialiteId", nom, prix
     FROM specialite_machines WHERE statut = 'publie' ORDER BY specialite_id, ordre`
  );
  const { rows: actes } = await pool.query(
    `SELECT id, specialite_id AS "specialiteId", type, nom, nbr_jour AS "nbrJour", prix_unitaire AS "prixUnitaire"
     FROM specialite_actes WHERE statut = 'publie' ORDER BY specialite_id, ordre`
  );

  return specs.map((s) => ({
    id: s.id,
    nom: s.nom,
    couleur: s.couleur,
    titre: s.titre_business_plan,
    specialiteNom: s.specialite_nom_bp,
    cibleKey: s.cible_key,
    cibleLabel: s.cible_label,
    poids: [
      { valeur: s.poids_1, label: s.poids_1_label },
      { valeur: s.poids_2, label: s.poids_2_label },
      { valeur: s.poids_3, label: s.poids_3_label },
    ],
    fraisPreliminaires: Number(s.frais_preliminaires),
    surfaceDefaut: s.surface_defaut,
    bfr: Number(s.bfr),
    amenagements: amenagements
      .filter((a) => a.specialiteId === s.id)
      .map(({ specialiteId, ...a }) => ({ ...a, prix: Number(a.prix) })),
    effectifs: effectifs
      .filter((e) => e.specialiteId === s.id)
      .map(({ specialiteId, ...e }) => ({ ...e, salaire: Number(e.salaire) })),
    machines: machines
      .filter((m) => m.specialiteId === s.id)
      .map(({ specialiteId, ...m }) => ({ ...m, prix: Number(m.prix) })),
    actes: actes
      .filter((a) => a.specialiteId === s.id)
      .map(({ specialiteId, ...a }) => ({ ...a, prixUnitaire: Number(a.prixUnitaire) })),
  }));
}
