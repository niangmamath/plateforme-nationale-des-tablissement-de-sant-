/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Globe, MapPin, Activity } from 'lucide-react';
import { Etablissement, KpiData, Specialite } from '../types';
import { motion } from 'motion/react';
import { ICONES, ICONE_DEFAUT, KPI_TEXTE_PAR_COULEUR, KPI_ICONE_PAR_COULEUR } from '../config/specialiteVisuels';

interface KpiSectionProps {
  kpis: KpiData;
  establishments: Etablissement[];
  specialites: Specialite[];
}

export default function KpiSection({ kpis, establishments, specialites }: KpiSectionProps) {
  // Une carte par spécialité publiée ayant au moins un établissement dans le périmètre actuel —
  // plus de liste de spécialités codée en dur : ça suit automatiquement ce qui est publié dans
  // Directus (specialites.categorie_etablissement) et ce qui existe réellement en base.
  const specialtyCards = useMemo(() => {
    return specialites
      .map((s) => ({
        specialite: s,
        count: establishments.filter((e) => e.categorie === s.categorieEtablissement).length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [establishments, specialites]);

  const fixedCards = [
    {
      id: "kpi-total",
      label: "Établissements",
      value: kpis.totalEtablissements.toLocaleString(),
      icon: Activity,
      textColor: "text-blue-600",
      iconColor: "text-blue-500",
      desc: "Cartographiés"
    },
    {
      id: "kpi-villes",
      label: "Villes",
      value: kpis.totalVilles.toLocaleString(),
      icon: Globe,
      textColor: "text-slate-800",
      iconColor: "text-emerald-500",
      desc: "Couvertes"
    },
    {
      id: "kpi-quartiers",
      label: "Quartiers",
      value: kpis.totalQuartiers.toLocaleString(),
      icon: MapPin,
      textColor: "text-slate-800",
      iconColor: "text-amber-500",
      desc: "Répertoriés"
    },
  ];

  const cards = [
    ...fixedCards,
    ...specialtyCards.map(({ specialite, count }) => ({
      id: `kpi-specialite-${specialite.id}`,
      label: specialite.nom,
      value: count.toLocaleString(),
      icon: ICONES[specialite.icone] ?? ICONE_DEFAUT,
      textColor: KPI_TEXTE_PAR_COULEUR[specialite.couleur] ?? 'text-slate-800',
      iconColor: KPI_ICONE_PAR_COULEUR[specialite.couleur] ?? 'text-slate-500',
      desc: specialite.categorieEtablissement,
    })),
  ];

  return (
    <div id="kpi-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 lg:divide-x divide-slate-200 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={card.id}
            id={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ backgroundColor: "rgba(241, 245, 249, 0.4)" }}
            className="flex-1 p-5 text-center flex flex-col justify-between min-h-[110px] transition-colors"
          >
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                {card.label}
              </div>
              <div className={`text-3xl font-black ${card.textColor} tracking-tight leading-none mt-2`}>
                {card.value}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold">
              <IconComponent className={`h-3 w-3 ${card.iconColor}`} />
              <span>{card.desc}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
