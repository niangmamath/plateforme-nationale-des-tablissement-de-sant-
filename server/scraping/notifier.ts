// Notifie l'admin Directus une fois le workflow GitHub Actions terminé — la notification créée
// au déclenchement (Flow "confirmer_declenchement") ne peut confirmer que le lancement, jamais
// le résultat : le scraping tourne en arrière-plan (10 min à 1h30), bien après la réponse du Flow.
const DIRECTUS_URL = 'https://directus-11-jual.onrender.com';
// Même utilisateur que celui qui possède le token statique — reçoit systématiquement la notification.
const RECIPIENT_ID = '14c7cfbd-ffd1-4a64-b2fc-5c100efbe21d';

export async function notifierDirectus(subject: string, message: string): Promise<void> {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!token) {
    console.warn('DIRECTUS_STATIC_TOKEN non définie — notification de fin de scraping sautée.');
    return;
  }
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/directus_notifications`, {
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
