import { useEffect, useState } from 'react';

// Navigation minimale par fragment d'URL (#/...), sans dépendance externe (pas de react-router) et
// sans aucune configuration serveur : contrairement à une URL "propre" comme /simulateur-credit, un
// fragment ne part jamais sur le réseau, donc recharger la page ne peut pas donner un 404 côté
// Vercel — pas de règle de réécriture à ajouter à vercel.json.
function lireRoute(): string {
  const fragment = window.location.hash.replace(/^#/, '');
  return fragment || '/';
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(lireRoute);
  useEffect(() => {
    const surChangement = () => setRoute(lireRoute());
    window.addEventListener('hashchange', surChangement);
    return () => window.removeEventListener('hashchange', surChangement);
  }, []);
  return route;
}
