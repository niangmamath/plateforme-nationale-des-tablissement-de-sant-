// Métadonnées par route — le site n'a pas de rendu côté serveur : index.html sert le même <title>,
// la même description et le même <link rel="canonical"> pour toutes les routes (utile pour /, la
// seule page qui existait quand ces balises ont été écrites). Depuis que /simulateur-credit est une
// vraie URL, il lui faut son propre titre et sa propre URL canonique, mis à jour ici au chargement
// de la page — Googlebot exécute le JavaScript avant d'indexer, donc ce correctif suffit pour
// l'indexation. Il ne change rien aux aperçus de partage (Facebook, LinkedIn, WhatsApp...) : ces
// robots-là ne lisent que le HTML statique de index.html, jamais le JavaScript — corriger ça
// demanderait un rendu par route côté serveur, un chantier à part.
export interface MetaRoute {
  titre: string;
  description: string;
}

const META_PAR_ROUTE: Record<string, MetaRoute> = {
  '/': {
    titre: 'Empower Doctor — Choisir la meilleure implantation pour son cabinet médical',
    description: "Empower Doctor aide les professionnels de santé à choisir la meilleure zone d'implantation au Maroc : concurrence, démographie, marché immobilier.",
  },
  '/simulateur-credit': {
    titre: 'Simulateur de crédit — Empower Doctor',
    description: "Calculez la mensualité, le coût total et le tableau d'amortissement mois par mois d'un crédit professionnel (local, équipement...).",
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
}
