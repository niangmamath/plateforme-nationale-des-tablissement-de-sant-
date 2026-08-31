/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';

// Sous ce seuil de distance au bas de page, on considère qu'on y est déjà — évite un bouton qui
// oscille entre les deux sens à cause d'un pixel d'arrondi ou d'une barre d'adresse mobile qui
// change discrètement la hauteur de viewport.
const SEUIL_BAS_PAGE_PX = 80;

export default function ScrollToggleButton() {
  const [pretDuBas, setPretDuBas] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const distanceAuBas = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setPretDuBas(distanceAuBas <= SEUIL_BAS_PAGE_PX);
      setVisible(window.scrollY > 200);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const handleClick = () => {
    window.scrollTo({
      top: pretDuBas ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      title={pretDuBas ? 'Remonter en haut' : 'Aller en bas'}
      aria-label={pretDuBas ? 'Remonter en haut de la page' : 'Aller en bas de la page'}
      className="fixed bottom-6 left-6 z-[9999] flex items-center justify-center w-11 h-11 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 border border-slate-800 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all"
    >
      {pretDuBas ? <ChevronsUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronsDown className="h-5 w-5" strokeWidth={2.5} />}
    </button>
  );
}
