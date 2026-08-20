// Notifie l'admin Directus une fois le workflow GitHub Actions terminé — la notification créée
// au déclenchement (Flow "confirmer_declenchement") ne peut confirmer que le lancement, jamais
// le résultat : le scraping tourne en arrière-plan (10 min à 1h30), bien après la réponse du Flow.
const DIRECTUS_URL = 'https://directus-11-jual.onrender.com';
// Même utilisateur que celui qui possède le token statique — reçoit systématiquement la notification.
const RECIPIENT_ID = '14c7cfbd-ffd1-4a64-b2fc-5c100efbe21d';

// Résumé "combien chaque source a réellement trouvé" pour un couple ville/catégorie — inclut
// Google Maps (toujours actif) et n'affiche que les sources externes réellement interrogées pour
// cette combinaison (ex. Radiologue n'a pas Med.ma, Clinique Privée n'a aucune source externe).
export function formatStatsParSource(extraitsGoogle: number, parSourceExterne: Record<string, number> | undefined): string {
  const parties = [`Google Maps ${extraitsGoogle}`];
  for (const [source, n] of Object.entries(parSourceExterne ?? {})) {
    parties.push(`${source} ${n}`);
  }
  return parties.join(' · ');
}

export async function notifierDirectus(subject: string, message: string): Promise<void> {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!token) {
    console.warn('DIRECTUS_STATIC_TOKEN non définie — notification de fin de scraping sautée.');
    return;
  }
  try {
    // L'endpoint générique /items/directus_notifications renvoie 403 même pour un compte
    // admin_access:true — Directus applique à cette collection système des règles réservées qui
    // ignorent le bypass admin habituel (confirmé en testant les deux : GET/POST sur /items/
    // échouent, l'endpoint dédié /notifications fonctionne normalement).
    const res = await fetch(`${DIRECTUS_URL}/notifications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: RECIPIENT_ID, subject, message }),
    });
    if (!res.ok) console.warn('Échec notification Directus :', res.status, await res.text());
  } catch (e: any) {
    // Une notification ratée ne doit jamais faire échouer le workflow lui-même.
    console.warn('Échec notification Directus :', e.message);
  }
}
