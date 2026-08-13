/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-50 via-blue-50/40 to-slate-100 px-6">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30"
      >
        <Activity className="h-7 w-7 stroke-[2.5]" />
      </motion.div>

      <div className="text-center max-w-md">
        <h1 className="text-lg font-black text-slate-900 tracking-tight">Bienvenue sur Empower Doctor</h1>
        <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-2">
          La plateforme qui aide les professionnels de santé à choisir leur meilleure zone
          d'implantation, grâce à l'analyse de la concurrence locale, de la démographie
          et du marché immobilier.
        </p>
      </div>

      <div className="w-48 h-1 rounded-full bg-slate-200 overflow-hidden">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
          animate={{ x: ['-100%', '250%'] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chargement des données...</p>
    </div>
  );
}
