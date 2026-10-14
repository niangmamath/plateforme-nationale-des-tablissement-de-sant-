// Métadonnées par route — le site n'a pas de rendu côté serveur : index.html sert le même <title>,
// la même description et le même <link rel="canonical"> pour toutes les routes. On patche ces
// balises au chargement de la page selon la route. Googlebot exécute le JavaScript avant
// d'indexer, donc ce correctif suffit pour l'indexation. Il ne change rien aux aperçus de partage
// (Facebook, LinkedIn, WhatsApp...) : ces robots-là ne lisent que le HTML statique de index.html,
// jamais le JavaScript — corriger ça demanderait un rendu par route côté serveur, un chantier à part.
export interface MetaRoute {
  titre: string;
  description: string;
  noindex?: boolean; // true = indique aux moteurs de ne pas indexer cette page
}

const META_PAR_ROUTE: Record<string, MetaRoute> = {
  '/': {
    titre: 'Empower Doctor — Guichet unique des professionnels de santé',
    description: "Empower Doctor accompagne les médecins de l'implantation à la gestion de leur cabinet : scoring de zone, business plan, financement, statut juridique et comptable.",
  },
  '/plateforme': {
    titre: 'Plateforme — Empower Doctor',
    description: "Carte interactive, scoring de zone, générateur de business plan et simulateurs de crédit pour choisir l'implantation de votre cabinet médical au Maroc.",
  },
  '/simulateur-credit': {
    titre: 'Simulateur de crédit — Empower Doctor',
    description: "Calculez la mensualité, le coût total et le tableau d'amortissement mois par mois d'un crédit professionnel (local, équipement...).",
  },
  // Dashboard admin : noindex (défense en profondeur). robots.txt bloque déjà /admin au niveau
  // crawl, mais si une URL fuit via un lien externe, les moteurs respecteront aussi ce signal-ci.
  '/admin': {
    titre: 'Admin — Empower Doctor',
    description: 'Accès réservé.',
    noindex: true,
  },
};

export function appliquerMeta(route: string): void {
  const meta = META_PAR_ROUTE[route] ?? META_PAR_ROUTE['/'];
  const base = 'https://empower-doctor.vercel.app';
  document.title = meta.titre;

  const balise = document.querySelector('meta[name="description"]');
  if (balise) balise.setAttribute('content', meta.description);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', base + route);

  // meta robots : patche la balise existante (celle d'index.html) selon la route. On la mute dans
  // les deux sens pour qu'une navigation /admin → / ne laisse pas le noindex traîner.
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    document.head.appendChild(robots);
  }
  robots.setAttribute('content', meta.noindex ? 'noindex, nofollow' : 'index, follow');
}
