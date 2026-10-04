// Envoi d'e-mails via l'API REST de Resend (pas de SDK : un simple fetch, comme les autres appels
// externes de ce projet — voir server/chat.ts pour OpenAI). L'expéditeur par défaut
// (onboarding@resend.dev) fonctionne sans domaine vérifié mais a une moins bonne délivrabilité ;
// une fois un domaine vérifié dans Resend, définir RESEND_FROM (ex. "Empower Doctor
// <contact@empower-doctor.ma>") pour l'utiliser à la place.
const RESEND_API = 'https://api.resend.com/emails';

// Ne jamais faire échouer le flux d'authentification (inscription, connexion...) à cause d'un
// e-mail qui ne part pas : on journalise et on continue — l'utilisateur garde la main via
// "renvoyer le code" si l'envoi a réellement échoué.
//
// `texte` (alternative en texte brut, à côté du HTML) : un e-mail purement HTML, sans partie
// texte, est un signal que regardent la plupart des filtres anti-spam (un e-mail légitime a
// presque toujours les deux, en multipart/alternative) — ça ne suffit pas à soi seul à éviter le
// dossier spam (la réputation d'un domaine/expéditeur tout neuf y contribue aussi, et se construit
// avec le temps), mais ça fait partie des signaux qu'on contrôle.
export async function envoyerEmail(destinataire: string, sujet: string, html: string, texte: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`RESEND_API_KEY non définie — e-mail « ${sujet} » non envoyé à ${destinataire}.`);
    return;
  }
  const from = process.env.RESEND_FROM || 'Empower Doctor <onboarding@resend.dev>';
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: destinataire, subject: sujet, html, text: texte }),
    });
    if (!res.ok) {
      const corps = await res.text().catch(() => '');
      console.error(`Erreur Resend (${res.status}) pour « ${sujet} » à ${destinataire} :`, corps.slice(0, 500));
    }
  } catch (err) {
    console.error(`Erreur réseau Resend pour « ${sujet} » à ${destinataire} :`, err);
  }
}

// --- Gabarit visuel commun ---
// Mise en page en <table> (pas de flex/grid) : c'est la seule approche fiable sur l'ensemble des
// clients mails (Outlook en particulier n'applique quasiment aucun CSS moderne).
//
// Volontairement sobre (pas de dégradé, pas d'ombre, pas de gros bouton coloré) : ce style
// "carte marketing" ressemble à ce que les filtres anti-spam associent le plus au spam/phishing,
// alors qu'un e-mail transactionnel sobre (texte noir sur fond blanc, un seul accent de couleur,
// peu de HTML par rapport au texte) passe mieux — c'est ce que font GitHub, Stripe, etc. pour leurs
// e-mails de connexion/vérification. Ceci dit, le facteur qui pèse le plus au départ reste la
// réputation d'un domaine d'envoi tout neuf (quasi aucun historique aux yeux de Gmail) : ça se
// construit avec le temps et le volume, aucun gabarit n'y changera grand-chose à lui seul.
function enveloppe(contenu: string): string {
  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">
            <tr>
              <td style="padding-bottom:20px;border-bottom:2px solid #1e293b;">
                <span style="font-size:13px;font-weight:800;letter-spacing:0.1em;color:#1e293b;">EMPOWER DOCTOR</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 0;">
                ${contenu}
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">Empower Doctor — choisir la meilleure implantation pour son cabinet médical.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function boiteCode(code: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 28px;">
        <span style="font-size:28px;font-weight:700;letter-spacing:0.3em;color:#1e293b;font-family:'Courier New',monospace;">${code}</span>
      </td></tr>
    </table>`;
}

export function emailCodeVerification(code: string): { sujet: string; html: string; texte: string } {
  const contenu = `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;">Confirmez votre adresse e-mail</p>
    <p style="margin:12px 0 0;font-size:14px;color:#475569;line-height:1.6;">Plus qu'une étape avant de pouvoir sauvegarder votre business plan et le reprendre à votre rythme. Voici votre code :</p>
    ${boiteCode(code)}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`;
  const texte = `Confirmez votre adresse e-mail\n\nVotre code de vérification : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n— Empower Doctor`;
  return { sujet: 'Votre code de vérification Empower Doctor', html: enveloppe(contenu), texte };
}

export function emailBienvenue(): { sujet: string; html: string; texte: string } {
  const url = process.env.APP_PUBLIC_URL || 'https://empower-doctor.vercel.app';
  const contenu = `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;">Bienvenue</p>
    <p style="margin:12px 0 0;font-size:14px;color:#475569;line-height:1.7;">Votre adresse est confirmée et votre compte est prêt. Remplissez votre business plan en plusieurs fois si besoin — chaque étape est sauvegardée automatiquement, vous retrouverez tout exactement où vous l'aviez laissé.</p>
    <p style="margin:20px 0 0;font-size:14px;"><a href="${url}" style="color:#2563eb;font-weight:600;">Ouvrir Empower Doctor →</a></p>`;
  const texte = `Bienvenue\n\nVotre adresse est confirmée et votre compte est prêt. Remplissez votre business plan en plusieurs fois si besoin — chaque étape est sauvegardée automatiquement.\n\nOuvrir Empower Doctor : ${url}\n\n— Empower Doctor`;
  return { sujet: 'Bienvenue sur Empower Doctor', html: enveloppe(contenu), texte };
}

export function emailCodeReinitialisation(code: string): { sujet: string; html: string; texte: string } {
  const contenu = `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;">Réinitialisation de mot de passe</p>
    <p style="margin:12px 0 0;font-size:14px;color:#475569;line-height:1.6;">Utilisez ce code pour choisir un nouveau mot de passe :</p>
    ${boiteCode(code)}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.</p>`;
  const texte = `Réinitialisation de mot de passe\n\nVotre code : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.\n\n— Empower Doctor`;
  return { sujet: 'Réinitialisation de votre mot de passe — Empower Doctor', html: enveloppe(contenu), texte };
}
