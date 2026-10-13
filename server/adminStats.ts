// Agrégats SQL pour le dashboard admin. Chaque fonction renvoie un JSON compact (quelques
// dizaines de lignes au plus) : Postgres fait le travail lourd (COUNT, GROUP BY, date_trunc),
// pas le navigateur. Chaque fonction reçoit le rôle pour masquer les champs sensibles aux lecteurs.

import type { Pool } from 'pg';
import type { RoleAdmin } from './adminAuth.js';

export class ErreurAdminStats extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Les sections exposées. L'ajout d'une nouvelle section se fait ici + dans le switch de
// `obtenirStats`, pour qu'une section inconnue soit toujours un 400 explicite.
export type SectionStats = 'overview' | 'etablissements' | 'zones' | 'specialites' | 'utilisateurs' | 'business-plans' | 'signalements';

const SECTIONS: SectionStats[] = ['overview', 'etablissements', 'zones', 'specialites', 'utilisateurs', 'business-plans', 'signalements'];

export function estSectionValide(s: unknown): s is SectionStats {
  return typeof s === 'string' && (SECTIONS as string[]).includes(s);
}

export async function obtenirStats(pool: Pool, section: SectionStats, role: RoleAdmin): Promise<unknown> {
  switch (section) {
    case 'overview': return statsOverview(pool);
    case 'etablissements': return statsEtablissements(pool);
    case 'zones': return statsZones(pool);
    case 'specialites': return statsSpecialites(pool);
    case 'utilisateurs': return statsUtilisateurs(pool);
    case 'business-plans': return statsBusinessPlans(pool);
    case 'signalements': return statsSignalements(pool);
    default: throw new ErreurAdminStats(400, 'Section inconnue.');
  }
}

// --- Overview : KPI en-tête + tendances + couverture géo + mini séries 30j ---
async function statsOverview(pool: Pool) {
  const [
    users, usersVerifies, users7j, users7jPrec,
    bpTotal, bp7j, bp7jPrec,
    etabPub, etabBr,
    specPub, specBr,
    signOuv, signTraites, sign7j, sign7jPrec,
    pays, villes, zones, zonesComplete,
    serieUsers30j, serieBp30j, serieSign30j,
    dernierUser, dernierEtab,
  ] = await Promise.all([
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users'),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users WHERE email_verified = true'),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users WHERE date_creation > now() - interval '7 days'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users WHERE date_creation > now() - interval '14 days' AND date_creation <= now() - interval '7 days'"),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM business_plan_drafts'),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM business_plan_drafts WHERE date_creation > now() - interval '7 days'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM business_plan_drafts WHERE date_creation > now() - interval '14 days' AND date_creation <= now() - interval '7 days'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM etablissements WHERE statut = 'publie'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM etablissements WHERE statut = 'brouillon'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM specialites WHERE statut = 'publie'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM specialites WHERE statut = 'brouillon'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM signalements WHERE statut IN ('nouveau', 'en_cours')"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM signalements WHERE statut IN ('traite', 'rejete')"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM signalements WHERE date_creation > now() - interval '7 days'"),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM signalements WHERE date_creation > now() - interval '14 days' AND date_creation <= now() - interval '7 days'"),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM pays'),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM villes'),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM zones'),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM zones WHERE population IS NOT NULL AND pop0_14 IS NOT NULL AND pop15_59 IS NOT NULL AND pop60_plus IS NOT NULL AND surface_km2 IS NOT NULL"),
    // Séries 30 derniers jours, alignées sur l'heure locale (Africa/Casablanca, UTC+1 constant
    // depuis 2018). Sans le AT TIME ZONE, Postgres tronque sur UTC et une inscription faite tard
    // le soir heure Maroc tomberait dans le jour d'avant.
    pool.query<{ jour: string; n: string }>(
      `WITH jours AS (SELECT generate_series((now() AT TIME ZONE 'Africa/Casablanca')::date - interval '29 days', (now() AT TIME ZONE 'Africa/Casablanca')::date, interval '1 day')::date AS jour)
       SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour, COUNT(u.id)::text AS n
       FROM jours j LEFT JOIN users u ON date_trunc('day', u.date_creation AT TIME ZONE 'Africa/Casablanca')::date = j.jour
       GROUP BY j.jour ORDER BY j.jour`
    ),
    pool.query<{ jour: string; n: string }>(
      `WITH jours AS (SELECT generate_series((now() AT TIME ZONE 'Africa/Casablanca')::date - interval '29 days', (now() AT TIME ZONE 'Africa/Casablanca')::date, interval '1 day')::date AS jour)
       SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour, COUNT(d.id)::text AS n
       FROM jours j LEFT JOIN business_plan_drafts d ON date_trunc('day', d.date_creation AT TIME ZONE 'Africa/Casablanca')::date = j.jour
       GROUP BY j.jour ORDER BY j.jour`
    ),
    pool.query<{ jour: string; n: string }>(
      `WITH jours AS (SELECT generate_series((now() AT TIME ZONE 'Africa/Casablanca')::date - interval '29 days', (now() AT TIME ZONE 'Africa/Casablanca')::date, interval '1 day')::date AS jour)
       SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour, COUNT(s.id)::text AS n
       FROM jours j LEFT JOIN signalements s ON date_trunc('day', s.date_creation AT TIME ZONE 'Africa/Casablanca')::date = j.jour
       GROUP BY j.jour ORDER BY j.jour`
    ),
    pool.query<{ d: string | null }>('SELECT MAX(date_creation)::text AS d FROM users'),
    pool.query<{ d: string | null }>('SELECT MAX(date_created)::text AS d FROM etablissements WHERE date_created IS NOT NULL'),
  ]);

  const totalUsers = Number(users.rows[0].n);
  const tauxVerifies = totalUsers ? Math.round((Number(usersVerifies.rows[0].n) / totalUsers) * 100) : 0;

  return {
    // KPI principaux
    utilisateurs: totalUsers,
    business_plans_total: Number(bpTotal.rows[0].n),
    etablissements_publies: Number(etabPub.rows[0].n),
    etablissements_brouillons: Number(etabBr.rows[0].n),
    specialites_publiees: Number(specPub.rows[0].n),
    specialites_brouillons: Number(specBr.rows[0].n),

    // Tendances 7j (avec évolution vs 7j précédents)
    users_7j: Number(users7j.rows[0].n),
    users_7j_precedent: Number(users7jPrec.rows[0].n),
    business_plans_7j: Number(bp7j.rows[0].n),
    business_plans_7j_precedent: Number(bp7jPrec.rows[0].n),
    signalements_7j: Number(sign7j.rows[0].n),
    signalements_7j_precedent: Number(sign7jPrec.rows[0].n),

    // Signalements
    signalements_ouverts: Number(signOuv.rows[0].n),
    signalements_traites: Number(signTraites.rows[0].n),

    // Qualité & conversion
    taux_verifies: tauxVerifies,

    // Couverture géographique
    pays: Number(pays.rows[0].n),
    villes: Number(villes.rows[0].n),
    zones: Number(zones.rows[0].n),
    zones_donnees_completes: Number(zonesComplete.rows[0].n),

    // Mini-séries 30 derniers jours
    serie_inscriptions_30j: serieUsers30j.rows.map(r => ({ jour: r.jour, n: Number(r.n) })),
    serie_business_plans_30j: serieBp30j.rows.map(r => ({ jour: r.jour, n: Number(r.n) })),
    serie_signalements_30j: serieSign30j.rows.map(r => ({ jour: r.jour, n: Number(r.n) })),

    // Dernières activités
    dernier_user: dernierUser.rows[0].d,
    dernier_etablissement: dernierEtab.rows[0].d,
  };
}

// --- Établissements ---
async function statsEtablissements(pool: Pool) {
  const [parStatut, parCategorie, parVille, parSource, aVerifier, parMois] = await Promise.all([
    pool.query<{ statut: string; n: string }>('SELECT statut, COUNT(*)::text AS n FROM etablissements GROUP BY statut'),
    pool.query<{ categorie: string; n: string }>('SELECT categorie, COUNT(*)::text AS n FROM etablissements GROUP BY categorie ORDER BY COUNT(*) DESC LIMIT 20'),
    pool.query<{ ville: string; n: string }>('SELECT ville, COUNT(*)::text AS n FROM etablissements GROUP BY ville ORDER BY COUNT(*) DESC LIMIT 15'),
    // On éclate la chaîne "DabaDoc, Doctori.ma, Med.ma" en sources individuelles pour éviter
    // le pie illisible de ~30 combinaisons. Un établissement peut compter dans plusieurs sources.
    pool.query<{ source: string; n: string }>(
      `SELECT TRIM(s) AS source, COUNT(*)::text AS n
       FROM etablissements, regexp_split_to_table(COALESCE(source, ''), '\\s*,\\s*') AS s
       WHERE TRIM(s) <> ''
       GROUP BY TRIM(s) ORDER BY COUNT(*) DESC`
    ),
    // Un établissement "à vérifier" = celui que le pipeline a flaggé (verification_requise=true)
    // OU qu'il soupçonne d'être un doublon. Les deux cas méritent la même action côté humain :
    // relire la fiche, décider de la publier/fusionner/supprimer. Fusionnés en un seul compteur.
    pool.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM etablissements WHERE verification_requise = true OR doublon_possible_id IS NOT NULL'
    ),
    pool.query<{ mois: string; n: string }>(
      `SELECT to_char(date_trunc('month', date_created), 'YYYY-MM') AS mois, COUNT(*)::text AS n
       FROM etablissements
       WHERE date_created IS NOT NULL
       GROUP BY 1 ORDER BY 1`
    ),
  ]);
  return {
    par_statut: parStatut.rows.map(r => ({ statut: r.statut, n: Number(r.n) })),
    par_categorie: parCategorie.rows.map(r => ({ categorie: r.categorie, n: Number(r.n) })),
    par_ville: parVille.rows.map(r => ({ ville: r.ville, n: Number(r.n) })),
    par_source: parSource.rows.map(r => ({ source: r.source, n: Number(r.n) })),
    a_verifier: Number(aVerifier.rows[0].n),
    par_mois: parMois.rows.map(r => ({ mois: r.mois, n: Number(r.n) })),
  };
}

// --- Zones ---
async function statsZones(pool: Pool) {
  const [pyramide, prix, nulls] = await Promise.all([
    pool.query<{ zone: string; ville: string; pop0_14: string | null; pop15_59: string | null; pop60_plus: string | null }>(
      `SELECT z.nom AS zone, v.nom AS ville, z.pop0_14, z.pop15_59, z.pop60_plus
       FROM zones z JOIN villes v ON v.id = z.ville_id
       WHERE z.pop0_14 IS NOT NULL AND z.pop15_59 IS NOT NULL AND z.pop60_plus IS NOT NULL
       ORDER BY v.nom, z.nom LIMIT 40`
    ),
    pool.query<{ zone: string; ville: string; prix_m2: string; loyer_m2: string }>(
      `SELECT z.nom AS zone, v.nom AS ville, z.prix_m2::text, z.loyer_m2::text
       FROM zones z JOIN villes v ON v.id = z.ville_id
       ORDER BY z.prix_m2 DESC LIMIT 30`
    ),
    pool.query<{ col: string; n: string }>(
      `SELECT 'population' AS col, COUNT(*) FILTER (WHERE population IS NULL)::text AS n FROM zones
       UNION ALL SELECT 'pop0_14', COUNT(*) FILTER (WHERE pop0_14 IS NULL)::text FROM zones
       UNION ALL SELECT 'pop15_59', COUNT(*) FILTER (WHERE pop15_59 IS NULL)::text FROM zones
       UNION ALL SELECT 'pop60_plus', COUNT(*) FILTER (WHERE pop60_plus IS NULL)::text FROM zones
       UNION ALL SELECT 'densite', COUNT(*) FILTER (WHERE densite IS NULL)::text FROM zones
       UNION ALL SELECT 'surface_km2', COUNT(*) FILTER (WHERE surface_km2 IS NULL)::text FROM zones`
    ),
  ]);
  return {
    pyramide_ages: pyramide.rows.map(r => ({
      zone: r.zone, ville: r.ville,
      pop0_14: r.pop0_14 ? Number(r.pop0_14) : null,
      pop15_59: r.pop15_59 ? Number(r.pop15_59) : null,
      pop60_plus: r.pop60_plus ? Number(r.pop60_plus) : null,
    })),
    prix_loyer: prix.rows.map(r => ({ zone: r.zone, ville: r.ville, prix_m2: Number(r.prix_m2), loyer_m2: Number(r.loyer_m2) })),
    manquants: nulls.rows.map(r => ({ colonne: r.col, n: Number(r.n) })),
  };
}

// --- Spécialités ---
async function statsSpecialites(pool: Pool) {
  const [specs, prixMoyens, parStatut, nbEnfants] = await Promise.all([
    pool.query<{
      id: string; nom: string; statut: string; frais_preliminaires: string; bfr: string;
      poids_prix: number; poids_population: number; poids_densite: number;
      poids_pop1559: number; poids_concurrence: number; poids_pop60plus: number; poids_pop0_14: number;
    }>(
      `SELECT id, nom, statut, frais_preliminaires::text, bfr::text,
              poids_prix, poids_population, poids_densite,
              poids_pop1559, poids_concurrence, poids_pop60plus, poids_pop0_14
       FROM specialites ORDER BY nom`
    ),
    pool.query<{ specialite_id: string; total_amenagement: string; total_machines: string }>(
      `SELECT s.id AS specialite_id,
              COALESCE((SELECT SUM(prix)::text FROM specialite_amenagements WHERE specialite_id = s.id), '0') AS total_amenagement,
              COALESCE((SELECT SUM(prix)::text FROM specialite_machines WHERE specialite_id = s.id), '0') AS total_machines
       FROM specialites s`
    ),
    pool.query<{ statut: string; n: string }>('SELECT statut, COUNT(*)::text AS n FROM specialites GROUP BY statut'),
    pool.query<{ specialite_id: string; nb_amen: string; nb_mach: string; nb_actes: string }>(
      `SELECT s.id AS specialite_id,
              (SELECT COUNT(*)::text FROM specialite_amenagements WHERE specialite_id = s.id) AS nb_amen,
              (SELECT COUNT(*)::text FROM specialite_machines     WHERE specialite_id = s.id) AS nb_mach,
              (SELECT COUNT(*)::text FROM specialite_actes        WHERE specialite_id = s.id) AS nb_actes
       FROM specialites s`
    ),
  ]);
  const parId: Record<string, { amen: number; mach: number }> = {};
  for (const r of prixMoyens.rows) parId[r.specialite_id] = { amen: Number(r.total_amenagement), mach: Number(r.total_machines) };
  const comptEnfants: Record<string, { nb_amen: number; nb_mach: number; nb_actes: number }> = {};
  for (const r of nbEnfants.rows) comptEnfants[r.specialite_id] = { nb_amen: Number(r.nb_amen), nb_mach: Number(r.nb_mach), nb_actes: Number(r.nb_actes) };

  const specialitesEnrichies = specs.rows.map(s => {
    const amen = parId[s.id]?.amen ?? 0;
    const mach = parId[s.id]?.mach ?? 0;
    const total = amen + mach + Number(s.frais_preliminaires) + Number(s.bfr);
    return {
      id: s.id,
      nom: s.nom,
      statut: s.statut,
      poids: {
        prix: s.poids_prix,
        population: s.poids_population,
        densite: s.poids_densite,
        pop0_14: s.poids_pop0_14,
        pop15_59: s.poids_pop1559,
        pop60_plus: s.poids_pop60plus,
        concurrence: s.poids_concurrence,
      },
      frais_preliminaires: Number(s.frais_preliminaires),
      bfr: Number(s.bfr),
      amenagement: amen,
      machines: mach,
      investissement_total: total,
      nb_amenagements: comptEnfants[s.id]?.nb_amen ?? 0,
      nb_machines: comptEnfants[s.id]?.nb_mach ?? 0,
      nb_actes: comptEnfants[s.id]?.nb_actes ?? 0,
    };
  });

  // Agrégats globaux
  const investissements = specialitesEnrichies.map(s => s.investissement_total).filter(v => v > 0);
  const investMoyen = investissements.length ? Math.round(investissements.reduce((a, b) => a + b, 0) / investissements.length) : 0;
  const investMedian = investissements.length ? [...investissements].sort((a, b) => a - b)[Math.floor(investissements.length / 2)] : 0;
  const plusCouteuse = [...specialitesEnrichies].sort((a, b) => b.investissement_total - a.investissement_total)[0] || null;
  const moinsCouteuse = [...specialitesEnrichies].filter(s => s.investissement_total > 0).sort((a, b) => a.investissement_total - b.investissement_total)[0] || null;

  // Poids moyens des 7 critères (indique sur quels axes la plateforme pondère le plus)
  const n = specialitesEnrichies.length || 1;
  const poidsMoyens = {
    prix:        Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.prix, 0) / n),
    population:  Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.population, 0) / n),
    densite:     Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.densite, 0) / n),
    pop0_14:     Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.pop0_14, 0) / n),
    pop15_59:    Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.pop15_59, 0) / n),
    pop60_plus:  Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.pop60_plus, 0) / n),
    concurrence: Math.round(specialitesEnrichies.reduce((a, s) => a + s.poids.concurrence, 0) / n),
  };

  // Répartition clientèle (cible_key : pop15_59, pop60_plus, null) et clientele_type
  const parCibleRows = await pool.query<{ cible: string; n: string }>(
    `SELECT COALESCE(cible_key, 'tous') AS cible, COUNT(*)::text AS n FROM specialites GROUP BY cible_key`
  );
  const parClienteleRows = await pool.query<{ type: string; n: string }>(
    `SELECT COALESCE(clientele_type, 'non_specifie') AS type, COUNT(*)::text AS n FROM specialites GROUP BY clientele_type`
  );

  // Nombre d'établissements publiés rattachés à chaque spécialité, via le mapping
  // specialites.categorie_etablissement = etablissements.categorie.
  // Consolidé en 1 query (vs 21 subqueries corrélées auparavant) : LEFT JOIN + GROUP BY.
  const nbEtabRows = await pool.query<{ id: string; nom: string; nb_etab: string }>(
    `SELECT s.id, s.nom, COUNT(e.id)::text AS nb_etab
     FROM specialites s
     LEFT JOIN etablissements e
       ON e.categorie = s.categorie_etablissement AND e.statut = 'publie'
     GROUP BY s.id, s.nom
     ORDER BY COUNT(e.id) DESC`
  );

  // Répartition par ville des établissements, pour les 10 spécialités les plus représentées × top 5 villes.
  // Permet un graphe empilé "où chaque spécialité est présente".
  const topSpecialiteIds = nbEtabRows.rows.filter(r => Number(r.nb_etab) > 0).slice(0, 10).map(r => r.id);
  let specialiteParVille: { specialite: string; ville: string; n: number }[] = [];
  if (topSpecialiteIds.length > 0) {
    const q = await pool.query<{ specialite: string; ville: string; n: string }>(
      `WITH top_villes AS (
         SELECT e.ville FROM etablissements e
         WHERE e.statut = 'publie' AND e.categorie IN (
           SELECT categorie_etablissement FROM specialites WHERE id = ANY($1::text[])
         )
         GROUP BY e.ville ORDER BY COUNT(*) DESC LIMIT 5
       )
       SELECT s.nom AS specialite, e.ville, COUNT(*)::text AS n
       FROM etablissements e
       JOIN specialites s ON s.categorie_etablissement = e.categorie
       WHERE e.statut = 'publie'
         AND s.id = ANY($1::text[])
         AND e.ville IN (SELECT ville FROM top_villes)
       GROUP BY s.nom, e.ville
       ORDER BY s.nom, e.ville`,
      [topSpecialiteIds]
    );
    specialiteParVille = q.rows.map(r => ({ specialite: r.specialite, ville: r.ville, n: Number(r.n) }));
  }

  return {
    par_statut: parStatut.rows.map(r => ({ statut: r.statut, n: Number(r.n) })),
    investissement_moyen: investMoyen,
    investissement_median: investMedian,
    plus_couteuse: plusCouteuse ? { nom: plusCouteuse.nom, montant: plusCouteuse.investissement_total } : null,
    moins_couteuse: moinsCouteuse ? { nom: moinsCouteuse.nom, montant: moinsCouteuse.investissement_total } : null,
    poids_moyens: poidsMoyens,
    par_cible: parCibleRows.rows.map(r => ({ cible: r.cible, n: Number(r.n) })),
    par_clientele: parClienteleRows.rows.map(r => ({ type: r.type, n: Number(r.n) })),
    nb_etablissements_par_specialite: nbEtabRows.rows.map(r => ({ id: r.id, nom: r.nom, nb_etab: Number(r.nb_etab) })),
    specialite_par_ville: specialiteParVille,
    specialites: specialitesEnrichies,
  };
}

// --- Utilisateurs ---
async function statsUtilisateurs(pool: Pool) {
  const [total, parSemaine, authType, verifies, verrouilles] = await Promise.all([
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users'),
    pool.query<{ semaine: string; n: string }>(
      `SELECT to_char(date_trunc('week', date_creation), 'YYYY-MM-DD') AS semaine, COUNT(*)::text AS n
       FROM users GROUP BY 1 ORDER BY 1`
    ),
    pool.query<{ type: string; n: string }>(
      `SELECT CASE WHEN google_sub IS NOT NULL THEN 'google' ELSE 'email' END AS type, COUNT(*)::text AS n
       FROM users GROUP BY 1`
    ),
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users WHERE email_verified = true'),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users WHERE login_locked_until IS NOT NULL AND login_locked_until > now()"),
  ]);

  const { rows } = await pool.query<{ id: number; email: string; date_creation: string; email_verified: boolean; auth: string }>(
    `SELECT id, email, date_creation, email_verified,
            CASE WHEN google_sub IS NOT NULL THEN 'google' ELSE 'email' END AS auth
     FROM users ORDER BY date_creation DESC LIMIT 20`
  );
  return {
    total: Number(total.rows[0].n),
    par_semaine: parSemaine.rows.map(r => ({ semaine: r.semaine, n: Number(r.n) })),
    par_type: authType.rows.map(r => ({ type: r.type, n: Number(r.n) })),
    verifies: Number(verifies.rows[0].n),
    verrouilles: Number(verrouilles.rows[0].n),
    derniers: rows,
  };
}

// --- Business plans ---
async function statsBusinessPlans(pool: Pool) {
  const [total, parUser, topZones, topSpecs, abandons] = await Promise.all([
    pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM business_plan_drafts'),
    pool.query<{ nb_bp: number; n: string }>(
      `SELECT nb_bp, COUNT(*)::text AS n FROM (
         SELECT user_id, COUNT(*)::int AS nb_bp FROM business_plan_drafts GROUP BY user_id
       ) q GROUP BY nb_bp ORDER BY nb_bp`
    ),
    pool.query<{ zone: string; ville: string; n: string }>(
      `SELECT z.nom AS zone, v.nom AS ville, COUNT(*)::text AS n
       FROM business_plan_drafts d
       JOIN zones z ON z.id = d.zone_id
       JOIN villes v ON v.id = z.ville_id
       GROUP BY z.nom, v.nom ORDER BY COUNT(*) DESC LIMIT 15`
    ),
    pool.query<{ specialite: string; n: string }>(
      `SELECT specialite_id AS specialite, COUNT(*)::text AS n
       FROM business_plan_drafts GROUP BY specialite_id ORDER BY COUNT(*) DESC LIMIT 15`
    ),
    pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM business_plan_drafts WHERE date_maj < now() - interval '30 days'"),
  ]);
  return {
    total: Number(total.rows[0].n),
    par_user_histogramme: parUser.rows.map(r => ({ nb_bp: r.nb_bp, n: Number(r.n) })),
    top_zones: topZones.rows.map(r => ({ zone: r.zone, ville: r.ville, n: Number(r.n) })),
    top_specialites: topSpecs.rows.map(r => ({ specialite: r.specialite, n: Number(r.n) })),
    abandons_30j: Number(abandons.rows[0].n),
  };
}

// --- Signalements ---
async function statsSignalements(pool: Pool) {
  const [parStatut, parType, parProbleme, parMois, delaiMoyen, parProfession] = await Promise.all([
    pool.query<{ statut: string; n: string }>('SELECT statut, COUNT(*)::text AS n FROM signalements GROUP BY statut'),
    pool.query<{ type: string; n: string }>('SELECT type, COUNT(*)::text AS n FROM signalements GROUP BY type'),
    pool.query<{ type_probleme: string; n: string }>(
      "SELECT COALESCE(type_probleme, 'non_specifie') AS type_probleme, COUNT(*)::text AS n FROM signalements GROUP BY 1"
    ),
    pool.query<{ mois: string; n: string }>(
      `SELECT to_char(date_trunc('month', date_creation), 'YYYY-MM') AS mois, COUNT(*)::text AS n
       FROM signalements GROUP BY 1 ORDER BY 1`
    ),
    pool.query<{ heures: string | null }>(
      `SELECT EXTRACT(EPOCH FROM AVG(date_traitement - date_creation))/3600 AS heures
       FROM signalements WHERE date_traitement IS NOT NULL`
    ),
    pool.query<{ profession: string; n: string }>(
      'SELECT profession, COUNT(*)::text AS n FROM signalements GROUP BY profession ORDER BY COUNT(*) DESC LIMIT 10'
    ),
  ]);

  return {
    par_statut: parStatut.rows.map(r => ({ statut: r.statut, n: Number(r.n) })),
    par_type: parType.rows.map(r => ({ type: r.type, n: Number(r.n) })),
    par_probleme: parProbleme.rows.map(r => ({ type_probleme: r.type_probleme, n: Number(r.n) })),
    par_mois: parMois.rows.map(r => ({ mois: r.mois, n: Number(r.n) })),
    delai_traitement_h: delaiMoyen.rows[0].heures ? Number(delaiMoyen.rows[0].heures) : null,
    par_profession: parProfession.rows.map(r => ({ profession: r.profession, n: Number(r.n) })),
  };
}
