/**
 * URL cible des tests e2e. Par défaut, la prod — c'est là que les incidents
 * (doublons, chargement bloqué) ont été constatés. Surchargeable via
 * TEST_BASE_URL (utilisé par le workflow CI pour tester une preview Vercel).
 */
export const BASE_URL = (process.env.TEST_BASE_URL ?? 'https://empower-doctor.vercel.app').replace(/\/$/, '');
