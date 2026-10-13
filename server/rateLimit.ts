// Rate-limiter très simple, in-memory. Même pattern que server/signalements.ts (déjà présent) :
// un Map (clé -> { compteur, debuteA }) qui s'auto-réinitialise après une fenêtre glissante.
//
// Limitation Vercel serverless : chaque instance de fonction a sa propre mémoire — un attaquant
// qui tombe sur une instance "froide" repart à zéro. Ce rate-limit reste donc une protection
// défense-en-profondeur ; la vraie limite d'un attaquant déterminé est le verrou par compte
// (login_fail_count / login_locked_until, 5 essais → 15 min, dans users et admin_users).

interface Entry { compteur: number; debuteA: number; }

export class RateLimit {
  private map = new Map<string, Entry>();
  constructor(
    private readonly maxTentatives: number,
    private readonly fenetreMs: number,
    private readonly nom: string, // pour les logs
  ) {}

  // Retourne true si la clé est OK (sous le quota), false si elle est bloquée.
  // Incrémente le compteur à chaque appel OK. Un appel bloqué n'incrémente pas (évite de prolonger
  // indéfiniment la fenêtre d'un attaquant qui continue à spam).
  verifier(cle: string): { ok: boolean; secondsRestantes?: number } {
    const maintenant = Date.now();
    const existant = this.map.get(cle);

    if (!existant || maintenant - existant.debuteA > this.fenetreMs) {
      this.map.set(cle, { compteur: 1, debuteA: maintenant });
      return { ok: true };
    }

    if (existant.compteur >= this.maxTentatives) {
      const restant = Math.ceil((existant.debuteA + this.fenetreMs - maintenant) / 1000);
      return { ok: false, secondsRestantes: restant };
    }

    existant.compteur += 1;
    return { ok: true };
  }

  // Nettoie périodiquement les entrées expirées — appelé par un setInterval au boot.
  purger(): void {
    const maintenant = Date.now();
    for (const [cle, e] of this.map.entries()) {
      if (maintenant - e.debuteA > this.fenetreMs) this.map.delete(cle);
    }
  }
}

// Extracteur d'IP sûr : prend le premier IP de x-forwarded-for (le plus proche du client), ou
// req.ip en fallback. Même logique que server/signalements.ts extraireIp(). Ne JAMAIS stocker
// l'IP en clair ailleurs qu'ici (en mémoire éphémère).
export function ipDeRequete(xForwardedFor: string | string[] | undefined, reqIp: string | undefined): string {
  const xff = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
  if (xff) return xff.split(',')[0]!.trim();
  return reqIp || 'unknown';
}
