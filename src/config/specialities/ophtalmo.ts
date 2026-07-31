export const OPHTALMO_CONFIG = {
  titre: "Business Plan - Ophtalmologie",
  specialiteNom: "Cabinet d'Ophtalmologie",
  amenagements: [
    { id: 1, nom: "Fourniture, Téléviseur, Standard Téléphonique", prix: 7000 },
    { id: 2, nom: "Réseau informatique et caméras", prix: 4625 },
    { id: 3, nom: "Peinture vinylique sur mur en deux couches", prix: 8000 },
    { id: 4, nom: "Porte en Inox", prix: 5500 },
    { id: 5, nom: "Faux plafond en ARMSTRONG", prix: 9350 },
    { id: 6, nom: "Revêtement de sol et murs en gres-cerame", prix: 2880 },
    { id: 7, nom: "Démolition, construction 2 toilettes", prix: 2000 },
    { id: 8, nom: "Pose de Gerflex", prix: 2000 }
  ],
  effectifs: [
    { id: 1, nom: "Médecin (Promoteur)", qte: 1, salaire: 12000 },
    { id: 2, nom: "Assistante", qte: 1, salaire: 3000 }
  ],
  machines: [
    { id: 1, nom: "REFRACTEUR AUTOMATIQUE (COMPU VISION TEST)", prix: 120834 },
    { id: 2, nom: "UNITE DE CONSULTATION 3 APPAREILS (TOPCON)", prix: 91666 },
    { id: 3, nom: "LAMPE A FENTE A 5 GROSSISSEMENTS LED", prix: 87500 },
    { id: 4, nom: "AUTO KERATO REFRACTOMETRE (TOPCON)", prix: 87500 },
    { id: 5, nom: "TONOMETRE PACHYMETRE A AIR PULSE", prix: 87500 },
    { id: 6, nom: "CAMERA DIGITALE ET NUMERIQUE HAUTE RÉSO", prix: 37500 },
    { id: 7, nom: "ECRAN LCD DE PROJECTION DE TESTS", prix: 26667 },
    { id: 8, nom: "FRONTOFOCOMETRE AUTOMATIQUE", prix: 23333 },
    { id: 9, nom: "DIVERS MATERIEL (lunettes, verres, siège...)", prix: 60000 }
  ],
  actes: [
    { id: 1, type: 'Consultation', nom: "Mesure de la réfraction de l'œil", nbrJour: 4, prixUnitaire: 250 },
    { id: 2, type: 'Consultation', nom: "Consultation pour permis conduire", nbrJour: 1, prixUnitaire: 150 },
    { id: 3, type: 'Consultation', nom: "Examen de la périphérie rétinienne", nbrJour: 2, prixUnitaire: 50 },
    { id: 4, type: 'Imagerie', nom: "Échographie Oculaire", nbrJour: 1, prixUnitaire: 500 },
    { id: 5, type: 'Imagerie', nom: "Biométrie (calcul d'implant)", nbrJour: 1, prixUnitaire: 400 },
    { id: 6, type: 'Chirurgie', nom: "Ablation de cils trichiasique", nbrJour: 1, prixUnitaire: 150 },
    { id: 7, type: 'Chirurgie', nom: "Vérification des voies lacrymales", nbrJour: 1, prixUnitaire: 300 },
    { id: 8, type: 'Chirurgie', nom: "Cure chirurgicale de chalazion", nbrJour: 1, prixUnitaire: 200 },
    { id: 9, type: 'Chirurgie', nom: "Interventions cliniques (Cataracte...)", nbrJour: 1, prixUnitaire: 230 }
  ]
};