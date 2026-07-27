/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpecialtyConfig {
  id: string;
  label: string;
  color: string;
  cibleKey: 'pop15_59' | 'pop60_plus';
  cibleLabel: string;
  scoring: {
    popWeight: number;
    powerWeight: number;
    compWeight: number;
    insightFort: string;
  };
  businessPlan: {
    equipementCout: number;
    caMensuelProj: number;
    equipementsList: string[];
  };
}

export const SPECIALTIES_CONFIG: Record<string, SpecialtyConfig> = {
  'Dermatologie': {
    id: 'Dermatologie',
    label: 'Dermatologie (Esthétique)',
    color: 'purple',
    cibleKey: 'pop15_59',
    cibleLabel: 'Actifs & Jeunes (15-59 ans)',
    scoring: {
      popWeight: 2.5,
      powerWeight: 5.5, // Très fort sur le pouvoir d'achat pour l'esthétique
      compWeight: 2,
      insightFort: "Excellent marché : Fort pouvoir d'achat garantissant la rentabilité des actes esthétiques non-remboursés."
    },
    businessPlan: {
      equipementCout: 450000,
      caMensuelProj: 5 * 22 * 400, // 5 consult/jour * 22 jours * 400 DH
      equipementsList: [
        "Laser épilatoire médical (Nd:YAG/Alexandrite)",
        "Appareil de cryothérapie",
        "Dermatoscope numérique LED",
        "Table d'examen électrique"
      ]
    }
  },
  'Ophtalmologie': {
    id: 'Ophtalmologie',
    label: 'Ophtalmologie',
    color: 'cyan',
    cibleKey: 'pop60_plus',
    cibleLabel: 'Seniors (60+ ans)',
    scoring: {
      popWeight: 4,
      powerWeight: 3,
      compWeight: 3,
      insightFort: "Fort potentiel : Très bonne concentration de seniors et une concurrence acceptable."
    },
    businessPlan: {
      equipementCout: 850000,
      caMensuelProj: 12 * 22 * 300,
      equipementsList: [
        "Tomographe à Cohérence Optique (OCT)",
        "Lampe à fente avec tonomètre",
        "Réfractomètre automatique",
        "Projecteur de tests de vue"
      ]
    }
  },
  'Cardiologie': {
    id: 'Cardiologie',
    label: 'Cardiologie',
    color: 'rose',
    cibleKey: 'pop60_plus',
    cibleLabel: 'Seniors à risque (60+ ans)',
    scoring: {
      popWeight: 5, // Primordial d'avoir des personnes âgées
      powerWeight: 2,
      compWeight: 3,
      insightFort: "Zone critique : Forte densité de seniors nécessitant un suivi cardio-vasculaire régulier."
    },
    businessPlan: {
      equipementCout: 650000,
      caMensuelProj: 10 * 22 * 350,
      equipementsList: [
        "Échographe Doppler couleur haut de gamme",
        "Électrocardiographe (ECG) 12 pistes",
        "Holter ECG et Tensionnel",
        "Défibrillateur automatisé externe (DAE)"
      ]
    }
  }
};