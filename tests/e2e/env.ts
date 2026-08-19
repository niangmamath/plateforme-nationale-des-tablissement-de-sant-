/**
 * URL cible des tests e2e. Par défaut, la prod — c'est là que les incidents
 * (doublons, chargement bloqué) ont été constatés. Surchargeable via
 * TEST_BASE_URL (utilisé par le workflow CI pour tester une preview Vercel).
 */
const baseUrlSansBypass = (process.env.TEST_BASE_URL ?? 'https://empower-doctor.vercel.app').replace(/\/$/, '');

// Les URLs de déploiement Vercel (une par commit, cf. l'événement deployment_status) sont
// protégées par le SSO Vercel par défaut : sans ce contournement, Selenium tombe sur la page de
// connexion Vercel au lieu du site, et TOUS les tests échouent identiquement (aucun élément de
// l'app dans le DOM). VERCEL_AUTOMATION_BYPASS_SECRET (généré dans Vercel > Project Settings >
// Deployment Protection > "Protection Bypass for Automation") ajouté en paramètre d'URL fait
// passer la requête ET pose un cookie de contournement pour la session — donc suffit de
// l'ajouter une fois ici plutôt que dans chaque fichier de test.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export const BASE_URL = bypassSecret
  ? `${baseUrlSansBypass}/?x-vercel-protection-bypass=${bypassSecret}&x-vercel-set-bypass-cookie=true`
  : baseUrlSansBypass;
