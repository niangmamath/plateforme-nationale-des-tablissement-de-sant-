const fs = require('fs');
const path = './src/data/etablissements.ts';

try {
  let data = fs.readFileSync(path, 'utf8');
  
  // Cette ligne magique cherche et supprime tous les champs inutiles (téléphone, rating, image, status, etc.)
  data = data.replace(/,\s*telephone:[\s\S]*?image:.*"[^\n]*/g, '');
  
  fs.writeFileSync(path, data);
  console.log("✅ Les fausses données ont été supprimées avec succès Chef !");
} catch (error) {
  console.error("Erreur : Vérifie que le fichier etablissements.ts est bien dans src/data/", error);
}