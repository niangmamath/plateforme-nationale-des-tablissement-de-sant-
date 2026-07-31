export const DERMATO_CONFIG = {
  titre: "Business Plan - Dermatologie",
  specialiteNom: "Cabinet de Dermatologie & Médecine Esthétique",
  amenagements: [
    { id: 1, nom: "Aménagements standards (Accueil, Peinture, Réseau...)", prix: 41355 },
    { id: 2, nom: "Mobilier d'accueil et décoration", prix: 15000 }
  ],
  effectifs: [
    { id: 1, nom: "Médecin Dermatologue", qte: 1, salaire: 12000 },
    { id: 2, nom: "Assistante Spécialisée (Esthétique)", qte: 1, salaire: 4000 }
  ],
  machines: [
    { id: 1, nom: "LASER ÉPILATOIRE (ND:YAG / ALEXANDRITE)", prix: 380000 },
    { id: 2, nom: "LASER CO2 FRACTIONNÉ (CICATRICES, RÉJUVÉNATION)", prix: 250000 },
    { id: 3, nom: "DERMATOSCOPE NUMÉRIQUE HAUTE RÉSOLUTION (FOTOFINDER)", prix: 85000 },
    { id: 4, nom: "FAUTEUIL D'EXAMEN ET DE SOINS ÉLECTRIQUE", prix: 35000 },
    { id: 5, nom: "APPAREIL DE CRYOTHÉRAPIE AVEC ACCESSOIRES", prix: 20000 },
    { id: 6, nom: "AUTOCLAVE (STÉRILISATION CLASSE B)", prix: 28000 },
    { id: 7, nom: "LAMPE LOUPE LED SUR PIED & PETIT MATÉRIEL", prix: 12000 },
    { id: 8, nom: "RÉFRIGÉRATEUR MÉDICAL (TOXINE BOTULIQUE)", prix: 8500 },
    { id: 9, nom: "ÉQUIPEMENT INFORMATIQUE ET LOGICIEL DE GESTION", prix: 25000 }
  ],
  actes: [
    { id: 1, type: 'Consultation', nom: "Consultation Dermatologique Classique", nbrJour: 10, prixUnitaire: 300 },
    { id: 2, type: 'Esthétique', nom: "Séance d'Épilation Définitive (Laser)", nbrJour: 5, prixUnitaire: 600 },
    { id: 3, type: 'Esthétique', nom: "Injections (Acide Hyaluronique / Botox)", nbrJour: 3, prixUnitaire: 2500 },
    { id: 4, type: 'Soins', nom: "Peeling Médical / Soin Hydrafacial", nbrJour: 2, prixUnitaire: 800 },
    { id: 5, type: 'Chirurgie', nom: "Petite Chirurgie (Exérèse de lésion, biopsie)", nbrJour: 2, prixUnitaire: 1000 }
  ]
};