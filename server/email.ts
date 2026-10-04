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
// clients mails (Outlook en particulier n'applique quasiment aucun CSS moderne). Couleurs et
// bandeau en dégradé repris de l'identité du site (SiteHeader : from-blue-600 to-indigo-700).
function enveloppe(badgeEmoji: string, contenu: string): string {
  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px -8px rgba(15,23,42,0.18);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#4338ca);padding:28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px;height:40px;background:rgba(255,255,255,0.18);border-radius:12px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">${badgeEmoji}</td>
                    <td style="padding-left:14px;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;vertical-align:middle;">Empower&nbsp;Doctor</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 32px;">
                ${contenu}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f7;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">Empower&nbsp;Doctor — choisir la meilleure implantation pour son cabinet médical.</p>
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center" style="background:linear-gradient(135deg,#eff6ff,#eef2ff);border:1px dashed #93c5fd;border-radius:16px;padding:22px 24px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#2563eb;">Votre code</p>
        <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:0.35em;color:#1e3a8a;font-family:'Courier New',monospace;">${code}</p>
      </td></tr>
    </table>`;
}

export function emailCodeVerification(code: string): { sujet: string; html: string; texte: string } {
  const contenu = `
    <h1 style="margin:0 0 4px;font-size:21px;color:#0f172a;">Confirmez votre adresse e-mail</h1>
    <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.6;">Plus qu'une étape avant de pouvoir sauvegarder votre business plan et le reprendre à votre rythme.</p>
    ${boiteCode(code)}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Ce code expire dans <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail — rien ne sera activé.</p>`;
  const texte = `Confirmez votre adresse e-mail\n\nVotre code de vérification : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n— Empower Doctor`;
  return { sujet: 'Votre code de vérification Empower Doctor', html: enveloppe('📧', contenu), texte };
}

export function emailBienvenue(): { sujet: string; html: string; texte: string } {
  const url = process.env.APP_PUBLIC_URL || 'https://empower-doctor.vercel.app';
  const contenu = `
    <h1 style="margin:0 0 4px;font-size:22px;color:#0f172a;">Bienvenue à bord 🎉</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">Votre adresse est confirmée et votre compte est prêt. Remplissez votre business plan en plusieurs fois si besoin — chaque étape est sauvegardée automatiquement, vous retrouverez tout exactement où vous l'aviez laissé.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr><td style="background:linear-gradient(135deg,#2563eb,#4338ca);border-radius:12px;">
        <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:13px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Ouvrir Empower Doctor →</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">À très vite sur la plateforme.</p>`;
  const texte = `Bienvenue à bord !\n\nVotre adresse est confirmée et votre compte est prêt. Remplissez votre business plan en plusieurs fois si besoin — chaque étape est sauvegardée automatiquement.\n\nOuvrir Empower Doctor : ${url}\n\n— Empower Doctor`;
  return { sujet: 'Bienvenue sur Empower Doctor', html: enveloppe('🎉', contenu), texte };
}

export function emailCodeReinitialisation(code: string): { sujet: string; html: string; texte: string } {
  const contenu = `
    <h1 style="margin:0 0 4px;font-size:21px;color:#0f172a;">Réinitialisation de mot de passe</h1>
    <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.6;">Utilisez ce code pour choisir un nouveau mot de passe.</p>
    ${boiteCode(code)}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Ce code expire dans <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.</p>`;
  const texte = `Réinitialisation de mot de passe\n\nVotre code : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.\n\n— Empower Doctor`;
  return { sujet: 'Réinitialisation de votre mot de passe — Empower Doctor', html: enveloppe('🔒', contenu), texte };
}
