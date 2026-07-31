import React, { useState } from 'react';
import { X, FileText, Calculator, Landmark, Plus, Trash2, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface AreaData {
  nom: string;
  ville: string;
  prixM2: number;
  population: number;
}

interface BusinessPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: AreaData | null;
  specialty: string | null;
}

// Dictionnaire des prix de location par mois et par m2
const PRIX_LOCATION: Record<string, number> = {
  "Anfa": 210,
  "El Maarif": 145,
  "Hay Hassani": 135,
  "Sidi Belyout": 120,
  "Aïn Chock": 100,
  "Roches Noires": 90,
  "Aïn Sebaâ": 80,
  "Sidi Moumen": 75,
  "Sidi Bernoussi": 75,
  "Ben-M'sick": 65,
  "Al-Fida": 65,
  "Mers Sultan": 65,
  "Sbata": 65,
  "Sidi Othmane": 65,
  "Hay Mohammadi": 65,
  "Moulay Rachid": 65,
  // Fallbacks pour les villes non listées (ex: Fès)
  "Agdal": 60, "Saïss": 50, "Zouagha": 40, "Méchouar Fès Jdid": 45
};

const formatDH = (num: number) => {
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
};

const formatHT = (num: number) => {
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function BusinessPlanOphtalmo({ isOpen, onClose, area, specialty }: BusinessPlanModalProps) {
  // --- ÉTATS DYNAMIQUES PRINCIPAUX ---
  const [surface, setSurface] = useState<number>(90); // Surface par défaut
  const [typeOccupation, setTypeOccupation] = useState<'achat' | 'location'>('achat');
  
  // 1. Aménagements (Modifiables)
  const [amenagements, setAmenagements] = useState([
    { id: 1, nom: "Fourniture, Téléviseur, Standard Téléphonique", prix: 7000 },
    { id: 2, nom: "Réseau informatique et caméras", prix: 4625 },
    { id: 3, nom: "Peinture vinylique sur mur en deux couches", prix: 8000 },
    { id: 4, nom: "Porte en Inox", prix: 5500 },
    { id: 5, nom: "Faux plafond en ARMSTRONG", prix: 9350 },
    { id: 6, nom: "Revêtement de sol et murs en gres-cerame", prix: 2880 },
    { id: 7, nom: "Démolition, construction 2 toilettes", prix: 2000 },
    { id: 8, nom: "Pose de Gerflex", prix: 2000 }
  ]);
  const [newAmenagementNom, setNewAmenagementNom] = useState('');
  const [newAmenagementPrix, setNewAmenagementPrix] = useState('');

  // 2. Effectifs (Modifiables)
  const [effectifs, setEffectifs] = useState([
    { id: 1, nom: "Médecin (Promoteur)", qte: 1, salaire: 12000 },
    { id: 2, nom: "Assistante", qte: 1, salaire: 3000 }
  ]);
  const [newEffectifNom, setNewEffectifNom] = useState('');
  const [newEffectifQte, setNewEffectifQte] = useState('');
  const [newEffectifSalaire, setNewEffectifSalaire] = useState('');

  // 3. Matériel (Modifiable)
  const [machines, setMachines] = useState([
    { id: 1, nom: "REFRACTEUR AUTOMATIQUE (COMPU VISION TEST)", prix: 120834 },
    { id: 2, nom: "UNITE DE CONSULTATION 3 APPAREILS (TOPCON)", prix: 91666 },
    { id: 3, nom: "LAMPE A FENTE A 5 GROSSISSEMENTS LED", prix: 87500 },
    { id: 4, nom: "AUTO KERATO REFRACTOMETRE (TOPCON)", prix: 87500 },
    { id: 5, nom: "TONOMETRE PACHYMETRE A AIR PULSE", prix: 87500 },
    { id: 6, nom: "CAMERA DIGITALE ET NUMERIQUE HAUTE RÉSO", prix: 37500 },
    { id: 7, nom: "ECRAN LCD DE PROJECTION DE TESTS", prix: 26667 },
    { id: 8, nom: "FRONTOFOCOMETRE AUTOMATIQUE", prix: 23333 },
    { id: 9, nom: "DIVERS MATERIEL (lunettes, verres, siège...)", prix: 60000 }
  ]);
  const [newMachineNom, setNewMachineNom] = useState('');
  const [newMachinePrix, setNewMachinePrix] = useState('');

  // 4. Actes & CA (Modifiables)
  const [actes, setActes] = useState([
    { id: 1, nom: "Mesure de la réfraction de l'œil", nbrJour: 4, prixUnitaire: 250 },
    { id: 2, nom: "Consultation pour permis conduire", nbrJour: 1, prixUnitaire: 150 },
    { id: 3, nom: "Examen de la périphérie rétinienne", nbrJour: 2, prixUnitaire: 50 },
    { id: 4, nom: "Échographie Oculaire", nbrJour: 1, prixUnitaire: 500 },
    { id: 5, nom: "Biométrie (calcul d'implant)", nbrJour: 1, prixUnitaire: 400 },
    { id: 6, nom: "Ablation de cils trichiasique", nbrJour: 1, prixUnitaire: 150 },
    { id: 7, nom: "Vérification des voies lacrymales", nbrJour: 1, prixUnitaire: 300 },
    { id: 8, nom: "Cure chirurgicale de chalazion", nbrJour: 1, prixUnitaire: 200 },
    { id: 9, nom: "Interventions cliniques (Cataracte...)", nbrJour: 1, prixUnitaire: 230 }
  ]);

  if (!isOpen || !area || !specialty) return null;

  // --- LOGIQUE D'AJOUT ET MODIFICATION DES AMÉNAGEMENTS ---
  const handleUpdateAmenagement = (id: number, newPrix: number) => {
    setAmenagements(amenagements.map(a => a.id === id ? { ...a, prix: newPrix } : a));
  };
  const handleRemoveAmenagement = (id: number) => {
    setAmenagements(amenagements.filter(a => a.id !== id));
  };
  const handleAddAmenagement = () => {
    if (newAmenagementNom && newAmenagementPrix) {
      setAmenagements([...amenagements, { 
        id: Date.now(), 
        nom: newAmenagementNom, 
        prix: parseFloat(newAmenagementPrix) 
      }]);
      setNewAmenagementNom(''); 
      setNewAmenagementPrix('');
    }
  };

  // --- LOGIQUE D'AJOUT ET MODIFICATION DES EFFECTIFS ---
  const handleUpdateEffectif = (id: number, field: 'qte' | 'salaire', value: number) => {
    setEffectifs(effectifs.map(e => e.id === id ? { ...e, [field]: value } : e));
  };
  const handleRemoveEffectif = (id: number) => {
    setEffectifs(effectifs.filter(e => e.id !== id));
  };
  const handleAddEffectif = () => {
    if (newEffectifNom && newEffectifQte && newEffectifSalaire) {
      setEffectifs([...effectifs, { 
        id: Date.now(), 
        nom: newEffectifNom, 
        qte: parseInt(newEffectifQte), 
        salaire: parseFloat(newEffectifSalaire) 
      }]);
      setNewEffectifNom(''); 
      setNewEffectifQte(''); 
      setNewEffectifSalaire('');
    }
  };

  // --- LOGIQUE D'AJOUT ET MODIFICATION DU MATÉRIEL ---
  const handleUpdateMachinePrice = (id: number, newPrix: number) => {
    setMachines(machines.map(m => m.id === id ? { ...m, prix: newPrix } : m));
  };
  const handleRemoveMachine = (id: number) => {
    setMachines(machines.filter(m => m.id !== id));
  };
  const handleAddMachine = () => {
    if (newMachineNom && newMachinePrix) {
      setMachines([...machines, { 
        id: Date.now(), 
        nom: newMachineNom.toUpperCase(), 
        prix: parseFloat(newMachinePrix) 
      }]);
      setNewMachineNom(''); 
      setNewMachinePrix('');
    }
  };

  // --- LOGIQUE DE MODIFICATION DES ACTES (CA) ---
  const handleUpdateActe = (id: number, field: 'nbrJour' | 'prixUnitaire', value: number) => {
    setActes(actes.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // --- CALCULS MATHÉMATIQUES ---
  
  // Aménagements
  const baseAmenagementHT = amenagements.reduce((acc, curr) => acc + curr.prix, 0);
  const surcoutSurfaceHT = (surface - 90) * 1500; 
  const totalAmenagementHT = baseAmenagementHT + surcoutSurfaceHT;
  const totalAmenagementTTC = totalAmenagementHT * 1.20;

  // Effectifs
  const masseSalariale = effectifs.reduce((acc, curr) => acc + (curr.qte * curr.salaire), 0);

  // Matériel
  const totalMaterielHT = machines.reduce((acc, curr) => acc + curr.prix, 0);
  const tvaMateriel = totalMaterielHT * 0.20;
  const totalMaterielTTC = totalMaterielHT + tvaMateriel;

  // Foncier
  const loyerM2 = PRIX_LOCATION[area.nom] || 50; 
  const loyerMensuel = surface * loyerM2;
  const investissementFoncier = typeOccupation === 'achat' 
    ? surface * area.prixM2 
    : loyerMensuel * 4;

  // Investissement Total
  const fraisPreliminaires = 5000;
  const bfr = 20000;
  const totalInvestissement = fraisPreliminaires + investissementFoncier + totalAmenagementTTC + totalMaterielTTC + bfr + masseSalariale;
  
  const apportPersonnel = totalInvestissement * 0.11; // 11%
  const creditSollicite = totalInvestissement * 0.89; // 89%

  // Exploitation
  const totalCAJour = actes.reduce((acc, acte) => acc + (acte.nbrJour * acte.prixUnitaire), 0);
  const totalCAAnnee = totalCAJour * 300; // 300 jours ouvrés

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 print:p-0 print:static">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm print:hidden" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="relative w-full max-w-6xl bg-white text-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[95vh] print:h-auto print:shadow-none print:rounded-none"
      >
        
        {/* EN-TÊTE MODALE */}
        <div className="flex justify-between items-center p-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-wide">Business Plan Détaillé - {specialty}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors shadow-lg shadow-blue-500/30"
            >
              <Printer className="h-4 w-4" /> PDF
            </button>
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-800 hover:bg-rose-600 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CORPS DU DOCUMENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 print:p-0 bg-slate-50">
          
          <div className="text-center mb-10 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-black uppercase mb-2 tracking-tight">Étude de Faisabilité et Business Plan</h1>
            <p className="text-lg font-bold text-blue-700 uppercase">Cabinet d'Ophtalmologie • {area.nom} ({area.ville})</p>
          </div>

          {/* PARAMÉTRAGE INTERACTIF (Caché au PDF) */}
          <div className="mb-10 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" /> Paramètres d'Ajustement Foncier
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Mode d'Occupation</label>
                <select 
                  value={typeOccupation} 
                  onChange={(e) => setTypeOccupation(e.target.value as 'achat' | 'location')} 
                  className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="achat">Achat Foncier</option>
                  <option value="location">Location Mensuelle</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Surface du local (m²)</label>
                <input 
                  type="number" 
                  value={surface} 
                  onChange={(e) => setSurface(Number(e.target.value))} 
                  className="w-28 px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Indice Immobilier Local</label>
                <div className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-slate-700 text-lg">
                  {typeOccupation === 'achat' 
                    ? `${area.prixM2.toLocaleString('fr-FR')} DH/m²` 
                    : `${loyerM2} DH/m²/mois`
                  }
                </div>
              </div>

              <p className="text-[11px] text-slate-400 font-medium max-w-md italic border-l-2 border-blue-400 pl-3">
                {typeOccupation === 'achat' 
                  ? "En modifiant la surface, le coût d'acquisition du foncier et les frais d'aménagement seront automatiquement recalculés."
                  : `Le loyer mensuel estimé est de ${formatHT(loyerMensuel)} DH. Le programme d'investissement inclut 4 mois de frais d'installation (Caution + Avance).`
                }
              </p>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            {/* AMÉNAGEMENTS MODIFIABLES */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
                I. Aménagements & Installations
                <span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span>
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Désignation</th>
                    <th className="border border-slate-300 p-2 text-right w-24">Prix HT (DH)</th>
                    <th className="border border-slate-300 p-2 w-8 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {amenagements.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-2 font-medium">
                        {a.nom}
                      </td>
                      <td className="border border-slate-300 p-2">
                        <input 
                          type="number" 
                          value={a.prix} 
                          onChange={(e) => handleUpdateAmenagement(a.id, parseFloat(e.target.value) || 0)} 
                          className="w-full bg-transparent text-right font-bold text-slate-800 outline-none print:border-none appearance-none" 
                        />
                      </td>
                      <td className="border border-slate-300 p-1 text-center print:hidden">
                        <button onClick={() => handleRemoveAmenagement(a.id)} className="text-rose-500 hover:bg-rose-100 p-1 rounded">
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Ligne d'ajout Aménagement */}
                  <tr className="print:hidden bg-blue-50/30">
                    <td className="border border-slate-300 p-1">
                      <input 
                        type="text" 
                        placeholder="Ajouter un aménagement..." 
                        value={newAmenagementNom} 
                        onChange={(e) => setNewAmenagementNom(e.target.value)} 
                        className="w-full p-1 text-xs outline-none rounded bg-white border border-slate-200" 
                      />
                    </td>
                    <td className="border border-slate-300 p-1">
                      <input 
                        type="number" 
                        placeholder="Prix" 
                        value={newAmenagementPrix} 
                        onChange={(e) => setNewAmenagementPrix(e.target.value)} 
                        className="w-full p-1 text-xs text-right outline-none rounded bg-white border border-slate-200" 
                      />
                    </td>
                    <td className="border border-slate-300 p-1 text-center">
                      <button onClick={handleAddAmenagement} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded transition-colors">
                        <Plus className="h-3 w-3 mx-auto" />
                      </button>
                    </td>
                  </tr>

                  {/* Ajustement surface si différent de 90 */}
                  {surface !== 90 && (
                    <tr className="bg-blue-50/50">
                      <td className="border border-slate-300 p-2 text-blue-700 font-medium">
                        Ajustement surface ({surface} m² au lieu de 90)
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-bold text-blue-700">
                        {formatHT(surcoutSurfaceHT)}
                      </td>
                      <td className="border border-slate-300 print:hidden"></td>
                    </tr>
                  )}

                  {/* Totaux Aménagement */}
                  <tr>
                    <td className="border border-slate-300 p-2 text-right font-black">PT HT :</td>
                    <td className="border border-slate-300 p-2 text-right font-black" colSpan={2}>
                      {formatHT(totalAmenagementHT)}
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="border border-slate-900 p-2 text-right font-black">PT TTC (TVA 20%) :</td>
                    <td className="border border-slate-900 p-2 text-right font-black text-sm" colSpan={2}>
                      {formatHT(totalAmenagementTTC)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* EFFECTIFS MODIFIABLES */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
                II. Effectif à Recruter
                <span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span>
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white mb-6">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border p-2 text-left">Poste</th>
                    <th className="border p-2 text-center w-12">Qté</th>
                    <th className="border p-2 text-right w-24">Salaire</th>
                    <th className="border p-2 w-8 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {effectifs.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="border p-2 font-medium">
                        {e.nom}
                      </td>
                      <td className="border p-2">
                        <input 
                          type="number" 
                          value={e.qte} 
                          onChange={(evt) => handleUpdateEffectif(e.id, 'qte', parseFloat(evt.target.value) || 0)} 
                          className="w-full text-center font-bold outline-none print:border-none" 
                        />
                      </td>
                      <td className="border p-2">
                        <input 
                          type="number" 
                          value={e.salaire} 
                          onChange={(evt) => handleUpdateEffectif(e.id, 'salaire', parseFloat(evt.target.value) || 0)} 
                          className="w-full text-right font-bold outline-none print:border-none" 
                        />
                      </td>
                      <td className="border p-1 text-center print:hidden">
                        <button onClick={() => handleRemoveEffectif(e.id)} className="text-rose-500 hover:bg-rose-100 p-1 rounded">
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Ligne d'ajout Effectif */}
                  <tr className="print:hidden bg-blue-50/30">
                    <td className="border border-slate-300 p-1">
                      <input 
                        type="text" 
                        placeholder="Ajouter un poste..." 
                        value={newEffectifNom} 
                        onChange={(e) => setNewEffectifNom(e.target.value)} 
                        className="w-full p-1 text-xs outline-none rounded bg-white border border-slate-200" 
                      />
                    </td>
                    <td className="border border-slate-300 p-1">
                      <input 
                        type="number" 
                        placeholder="Qté" 
                        value={newEffectifQte} 
                        onChange={(e) => setNewEffectifQte(e.target.value)} 
                        className="w-full p-1 text-xs text-center outline-none rounded bg-white border border-slate-200" 
                      />
                    </td>
                    <td className="border border-slate-300 p-1">
                      <input 
                        type="number" 
                        placeholder="Salaire" 
                        value={newEffectifSalaire} 
                        onChange={(e) => setNewEffectifSalaire(e.target.value)} 
                        className="w-full p-1 text-xs text-right outline-none rounded bg-white border border-slate-200" 
                      />
                    </td>
                    <td className="border border-slate-300 p-1 text-center">
                      <button onClick={handleAddEffectif} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded transition-colors">
                        <Plus className="h-3 w-3 mx-auto" />
                      </button>
                    </td>
                  </tr>

                  {/* Total Provision Effectifs */}
                  <tr className="bg-slate-100">
                    <td colSpan={2} className="border p-2 font-black text-right">
                      Provision Mensuelle :
                    </td>
                    <td className="border p-2 text-right font-black text-blue-700" colSpan={2}>
                      {formatHT(masseSalariale)} DH
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MATÉRIEL MÉDICAL MODIFIABLE */}
          <div className="mb-12 page-break-inside-avoid">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
              III. Matériel Médical Ophtalmologique
              <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider print:hidden">Édition activée</span>
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 p-3 uppercase font-black text-slate-700">Désignation</th>
                  <th className="border border-slate-300 p-3 uppercase font-black text-slate-700 w-40 text-right">Montant HT (DH)</th>
                  <th className="border border-slate-300 p-3 w-12 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 p-3 font-medium text-slate-800">
                      {m.nom}
                    </td>
                    <td className="border border-slate-300 p-2">
                      <input 
                        type="number" 
                        value={m.prix} 
                        onChange={(e) => handleUpdateMachinePrice(m.id, parseFloat(e.target.value) || 0)} 
                        className="w-full bg-transparent text-right font-bold text-slate-800 border-b-2 border-transparent focus:border-blue-500 focus:outline-none px-2 py-1 print:border-none appearance-none" 
                      />
                    </td>
                    <td className="border border-slate-300 p-2 text-center print:hidden">
                      <button onClick={() => handleRemoveMachine(m.id)} className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Ligne d'ajout Matériel */}
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border border-slate-300 p-2">
                    <input 
                      type="text" 
                      placeholder="Ajouter un équipement..." 
                      value={newMachineNom} 
                      onChange={(e) => setNewMachineNom(e.target.value)} 
                      className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </td>
                  <td className="border border-slate-300 p-2">
                    <input 
                      type="number" 
                      placeholder="Prix HT (DH)" 
                      value={newMachinePrix} 
                      onChange={(e) => setNewMachinePrix(e.target.value)} 
                      className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                    />
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    <button onClick={handleAddMachine} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm w-full flex justify-center">
                      <Plus className="h-4 w-4" />
                    </button>
                  </td>
                </tr>

                {/* Totaux Matériel */}
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 p-3 text-right font-black uppercase text-[11px]">PT HT :</td>
                  <td className="border border-slate-300 p-3 text-right font-black" colSpan={2}>
                    {formatHT(totalMaterielHT)}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 p-3 text-right font-black uppercase text-[11px]">TVA 20% :</td>
                  <td className="border border-slate-300 p-3 text-right font-black text-slate-500" colSpan={2}>
                    {formatHT(tvaMateriel)}
                  </td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td className="border border-slate-900 p-3 text-right font-black uppercase">PT TTC :</td>
                  <td className="border border-slate-900 p-3 text-right font-black text-lg" colSpan={2}>
                    {formatHT(totalMaterielTTC)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* EXPLOITATION PRÉVISIONNELLE MODIFIABLE */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
              IV. Chiffre d'Affaires Prévisionnel
              <span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Volumes et Tarifs Modifiables</span>
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border p-3 text-left uppercase">Nature des actes</th>
                  <th className="border p-3 text-center uppercase w-24">Actes/Jour</th>
                  <th className="border p-3 text-center uppercase w-32">Tarif Moyen (DH)</th>
                  <th className="border p-3 text-right uppercase w-32">CA Quotidien</th>
                </tr>
              </thead>
              <tbody>
                {actes.map(acte => (
                  <tr key={acte.id} className="hover:bg-slate-50">
                    <td className="border p-3 font-medium text-slate-700">
                      {acte.nom}
                    </td>
                    <td className="border p-2">
                      <input 
                        type="number" 
                        value={acte.nbrJour} 
                        onChange={(e) => handleUpdateActe(acte.id, 'nbrJour', parseFloat(e.target.value) || 0)} 
                        className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none text-blue-700" 
                      />
                    </td>
                    <td className="border p-2">
                      <input 
                        type="number" 
                        value={acte.prixUnitaire} 
                        onChange={(e) => handleUpdateActe(acte.id, 'prixUnitaire', parseFloat(e.target.value) || 0)} 
                        className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none" 
                      />
                    </td>
                    <td className="border p-3 text-right font-bold text-slate-900">
                      {formatHT(acte.nbrJour * acte.prixUnitaire)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50">
                  <td className="border p-3 font-black text-right uppercase" colSpan={3}>
                    TOTAL CA / JOUR :
                  </td>
                  <td className="border p-3 font-black text-right text-lg text-blue-700">
                    {formatHT(totalCAJour)} DH
                  </td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td className="border p-4 font-black text-right uppercase" colSpan={3}>
                    CA ANNUEL (Base 300 jours ouvrés) :
                  </td>
                  <td className="border p-4 font-black text-right text-xl">
                    {formatHT(totalCAAnnee)} DH
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PLAN DE FINANCEMENT (Calculs finaux) */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4">V. Programme d'Investissement & Financement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <table className="w-full text-xs border-collapse bg-white shadow-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-300 bg-slate-50 p-3 text-left font-black text-slate-800" colSpan={2}>
                      Détail de l'Investissement (TTC)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-3 uppercase font-medium">Frais Préliminaires</td>
                    <td className="border border-slate-300 p-3 text-right font-black">{formatHT(fraisPreliminaires)}</td>
                  </tr>
                  
                  {/* LIGNE DYNAMIQUE ACHAT VS LOCATION */}
                  <tr className="bg-blue-50/40">
                    <td className="border border-slate-300 p-3 uppercase font-bold text-blue-900">
                      {typeOccupation === 'achat' 
                        ? `Achat du Local (${surface} m² x ${area.prixM2.toLocaleString('fr-FR')} DH)`
                        : `Frais d'installation (${surface} m² - Caution 3 mois + Agence)`
                      }
                    </td>
                    <td className="border border-slate-300 p-3 text-right font-black text-blue-700">
                      {formatHT(investissementFoncier)}
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-300 p-3 uppercase font-medium">Aménagements et Installations</td>
                    <td className="border border-slate-300 p-3 text-right font-black">{formatHT(totalAmenagementTTC)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-3 uppercase font-medium">Matériels & Équipements Médicaux</td>
                    <td className="border border-slate-300 p-3 text-right font-black">{formatHT(totalMaterielTTC)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-3 uppercase font-medium">Besoins en Fonds de Roulement</td>
                    <td className="border border-slate-300 p-3 text-right font-black">{formatHT(bfr)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-3 uppercase font-medium">Provision Masse Salariale (1 mois)</td>
                    <td className="border border-slate-300 p-3 text-right font-black">{formatHT(masseSalariale)}</td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="border border-slate-900 p-4 font-black uppercase text-sm tracking-wide">Total Investissement</td>
                    <td className="border border-slate-900 p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse bg-white shadow-sm h-fit">
                <thead>
                  <tr>
                    <th className="border border-slate-300 bg-slate-50 p-3 text-left font-black text-slate-800" colSpan={3}>
                      Plan de Financement Envisagé
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-4 uppercase font-medium">Apport Personnel</td>
                    <td className="border border-slate-300 p-4 text-center font-black text-slate-600">11 %</td>
                    <td className="border border-slate-300 p-4 text-right font-black text-emerald-600 text-sm">{formatDH(apportPersonnel)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-4 uppercase font-medium">Crédit Sollicité</td>
                    <td className="border border-slate-300 p-4 text-center font-black text-slate-600">89 %</td>
                    <td className="border border-slate-300 p-4 text-right font-black text-rose-600 text-sm">{formatDH(creditSollicite)}</td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="border border-slate-900 p-4 font-black uppercase text-sm tracking-wide">Total Financement</td>
                    <td className="border border-slate-900 p-4 text-center font-black">100 %</td>
                    <td className="border border-slate-900 p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Box Lead Generation (identique à ton image jaune) */}
            <div className="mt-6 p-5 bg-[#fffdf0] border border-[#f5e3a8] rounded-xl flex items-start gap-4 print:hidden shadow-sm">
              <Landmark className="h-8 w-8 text-[#d4af37] shrink-0" />
              <div>
                <h4 className="font-black text-[#856614] text-lg leading-tight mb-1">Demande de Financement Bancaire</h4>
                <p className="text-sm text-[#a3801f]">
                  Enregistrez ce PDF pour le transmettre à votre partenaire financier pour le crédit de <strong className="font-black">{formatDH(creditSollicite)}</strong>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
      
      {/* Styles globaux pour forcer une impression PDF parfaite */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .fixed { position: absolute; }
          .print\\:static { position: static !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          
          .relative.w-full.max-w-6xl, .relative.w-full.max-w-6xl * { visibility: visible; }
          .relative.w-full.max-w-6xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            overflow: visible !important;
            height: auto !important;
          }
        }
      `}} />
    </div>
  );
}