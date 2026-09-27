import { useCallback, useEffect, useState } from 'react';

// Navigation par vraies URL (/simulateur-credit, sans #), via l'API History du navigateur — pas de
// dépendance externe (pas de react-router). Contrepartie : contrairement à un fragment #/..., ces
// chemins partent sur le réseau si on recharge la page ou qu'on tape l'URL directement, donc le
// serveur doit savoir y répondre. Sur Vercel, la règle de réécriture dans vercel.json renvoie
// index.html pour toute route qui n'est ni un fichier statique existant ni une fonction /api/... ;
// en développement, le serveur Vite fait ce même repli vers index.html par défaut.
//
// `ancre` reste un vrai fragment d'URL (#section-id), utilisé pour cibler une section de la page
// d'accueil (ex. "/#scoring-section") sans en faire une page à part.
interface Localisation {
  route: string;
  ancre: string;
}

function lire(): Localisation {
  return { route: window.location.pathname, ancre: window.location.hash.replace(/^#/, '') };
}

export function useRoute(): Localisation & { naviguer: (cible: string) => void } {
  const [localisation, setLocalisation] = useState(lire);

  useEffect(() => {
    const surChangement = () => setLocalisation(lire());
    window.addEventListener('popstate', surChangement);
    window.addEventListener('hashchange', surChangement);
    return () => {
      window.removeEventListener('popstate', surChangement);
      window.removeEventListener('hashchange', surChangement);
    };
  }, []);

  // `cible` : chemin réel, avec ancre éventuelle ("/simulateur-credit", "/#scoring-section"...).
  const naviguer = useCallback((cible: string) => {
    const url = new URL(cible, window.location.origin);
    if (url.pathname === window.location.pathname && url.hash === window.location.hash) return;
    window.history.pushState(null, '', cible);
    setLocalisation({ route: url.pathname, ancre: url.hash.replace(/^#/, '') });
  }, []);

  return { ...localisation, naviguer };
}
