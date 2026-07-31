export const CLINIQUE_CONFIG = {
  titre: "Business Plan - Clinique Privée",
  specialiteNom: "Polyclinique Médico-Chirurgicale",
  
  // Dans le générateur universel, "amenagements" gère les travaux. 
  // Pour une clinique, ce sont des "Constructions".
  amenagements: [
    { id: 1, nom: "Construction gros œuvre & second œuvre (Moyenne)", prix: 6000000 },
    { id: 2, nom: "Fluides médicaux & Plombage Radiologie", prix: 1500000 },
    { id: 3, nom: "Système de climatisation & Traitement d'air blocs", prix: 800000 }
  ],
  
  effectifs: [
    { id: 1, nom: "Direction Médicale & Administrative", qte: 1, salaire: 50000 },
    { id: 2, nom: "Médecins Urgentistes & Réanimateurs", qte: 6, salaire: 20000 },
    { id: 3, nom: "Corps Infirmier & Aides-soignants", qte: 15, salaire: 6000 },
    { id: 4, nom: "Administration, Accueil & Sécurité", qte: 10, salaire: 4000 }
  ],
  
  machines: [
    { id: 1, nom: "BLOCS OPÉRATOIRES COMPLETS (X3 Salles)", prix: 4500000 },
    { id: 2, nom: "IRM 1.5 TESLA & SCANNER MULTIBARRETTES", prix: 7500000 },
    { id: 3, nom: "ÉQUIPEMENT SALLE DE RÉANIMATION (X5 LITS)", prix: 1200000 },
    { id: 4, nom: "MOBILIER D'HOSPITALISATION (X30 LITS MÉDICALISÉS)", prix: 900000 },
    { id: 5, nom: "UNITÉ D'IMAGERIE CONVENTIONNELLE & ÉCHOGRAPHIE", prix: 850000 },
    { id: 6, nom: "LABORATOIRE D'ANALYSES D'URGENCE (POCT)", prix: 450000 },
    { id: 7, nom: "SYSTÈME D'INFORMATION HOSPITALIER (SIH) & SERVEURS", prix: 350000 },
    { id: 8, nom: "CENTRALE D'OXYGÈNE ET FLUIDES MÉDICAUX", prix: 600000 },
    { id: 9, nom: "STÉRILISATION CENTRALE (AUTOCLAVES GRANDE CAPACITÉ)", prix: 550000 }
  ],
  
  actes: [
    { id: 1, type: 'Urgences', nom: "Passages aux Urgences", nbrJour: 30, prixUnitaire: 300 },
    { id: 2, type: 'Hospitalisation', nom: "Nuitées d'Hospitalisation Classique", nbrJour: 20, prixUnitaire: 1200 },
    { id: 3, type: 'Chirurgie', nom: "Interventions Chirurgicales (Blocs)", nbrJour: 10, prixUnitaire: 8500 },
    { id: 4, type: 'Imagerie', nom: "Actes d'Imagerie Lourde (IRM/Scanner)", nbrJour: 15, prixUnitaire: 1500 },
    { id: 5, type: 'Maternité', nom: "Accouchements (Voie basse & Césarienne)", nbrJour: 3, prixUnitaire: 4500 }
  ],

  // Variables spécifiques pour surcharger le générateur
  surfaceDefaut: 1500, // Une clinique est beaucoup plus grande !
  fraisPreliminaires: 150000, // Études d'impact, architecte
  bfr: 1500000 // Fonds de roulement très lourd
};