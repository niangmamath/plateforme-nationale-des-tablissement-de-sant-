import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import {
  inscrire, connecter, connecterAvecGoogle, creerJeton, cookieSession, cookieDeconnexion, utilisateurDepuisCookies, ErreurAuth,
  verifierEmail, renvoyerCodeVerification, demanderReinitialisationMotDePasse, reinitialiserMotDePasse,
} from '../server/auth.js';

// Un seul fichier pour toutes les actions d'authentification (signup/login/google/logout) plutôt
// que 5 fonctions Vercel séparées : le plan Hobby limite à 12 fonctions serverless par déploiement,
// et le projet en avait déjà 8 avant l'ajout des comptes utilisateur (voir git history du
// 2026-10-04 : le premier découpage en 5 fichiers a fait échouer le déploiement, "No more than 12
// Serverless Functions"). GET renvoie l'utilisateur courant ; POST dispatch sur body.action.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
    if (!utilisateur) {
      res.status(401).json({ error: 'Non connecté.' });
      return;
    }
    res.status(200).json(utilisateur);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const { action } = req.body ?? {};
  try {
    switch (action) {
      case 'signup': {
        // Volontairement pas de session ici : s'inscrire ne doit pas donner accès directement,
        // l'utilisateur doit ensuite se connecter explicitement (voir action 'login').
        const { email, password } = req.body;
        const utilisateur = await inscrire(getPool(), email, password);
        res.status(201).json(utilisateur);
        return;
      }
      case 'login': {
        const { email, password } = req.body;
        const utilisateur = await connecter(getPool(), email, password);
        res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
        res.status(200).json(utilisateur);
        return;
      }
      case 'google': {
        const { idToken } = req.body;
        const utilisateur = await connecterAvecGoogle(getPool(), idToken);
        res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
        res.status(200).json(utilisateur);
        return;
      }
      case 'logout': {
        res.setHeader('Set-Cookie', cookieDeconnexion());
        res.status(200).json({ ok: true });
        return;
      }
      case 'verify-email': {
        const { email, code } = req.body;
        await verifierEmail(getPool(), email, code);
        res.status(200).json({ ok: true });
        return;
      }
      case 'resend-verification': {
        const { email } = req.body;
        await renvoyerCodeVerification(getPool(), email);
        res.status(200).json({ ok: true });
        return;
      }
      case 'forgot-password': {
        // Réponse toujours générique : ne jamais laisser deviner si l'adresse est enregistrée.
        const { email } = req.body;
        await demanderReinitialisationMotDePasse(getPool(), email);
        res.status(200).json({ ok: true, message: 'Si un compte existe avec cette adresse, un code vient de lui être envoyé.' });
        return;
      }
      case 'reset-password': {
        const { email, code, password } = req.body;
        await reinitialiserMotDePasse(getPool(), email, code, password);
        res.status(200).json({ ok: true });
        return;
      }
      default:
        res.status(400).json({ error: 'Action inconnue.' });
    }
  } catch (err: any) {
    if (err instanceof ErreurAuth) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/auth :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
