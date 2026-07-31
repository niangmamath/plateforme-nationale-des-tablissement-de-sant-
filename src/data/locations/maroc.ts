import { PaysGeo } from '../../types';

export const MAROC: PaysGeo = {
  id: 'MA',
  nom: 'Maroc',
  devise: 'DH',
  villes: [
    {
      id: 'CASA',
      nom: 'Casablanca',
      lat: 33.5731, 
      lng: -7.5898,
      zoomBase: 12,
      zones: [
        { id: 'anfa', nom: 'Anfa', lat: 33.5915, lng: -7.6433, population: 150000, prixM2: 18500, loyerM2: 210 },
        { id: 'maarif', nom: 'El Maarif', lat: 33.5822, lng: -7.6331, population: 170000, prixM2: 15500, loyerM2: 145 },
        { id: 'hay-hassani', nom: 'Hay Hassani', lat: 33.5658, lng: -7.6698, population: 536887, prixM2: 9500, loyerM2: 135 },
        { id: 'sidi-belyout', nom: 'Sidi Belyout', lat: 33.5925, lng: -7.6074, population: 136392, prixM2: 14500, loyerM2: 120 },
        { id: 'ain-chock', nom: 'Aïn Chock', lat: 33.5350, lng: -7.6050, population: 350000, prixM2: 10500, loyerM2: 100 },
        { id: 'ain-sebaa', nom: 'Aïn Sebaâ', lat: 33.6067, lng: -7.5388, population: 250000, prixM2: 8500, loyerM2: 80 },
        { id: 'sidi-moumen', nom: 'Sidi Moumen', lat: 33.5900, lng: -7.5100, population: 551118, prixM2: 7000, loyerM2: 75 },
        { id: 'sidi-bernoussi', nom: 'Sidi Bernoussi', lat: 33.6100, lng: -7.5100, population: 153621, prixM2: 7500, loyerM2: 75 },
        { id: 'roches-noires', nom: 'Roches Noires', lat: 33.6000, lng: -7.5800, population: 104694, prixM2: 9000, loyerM2: 90 },
        { id: 'moulay-rachid', nom: 'Moulay Rachid', lat: 33.5600, lng: -7.5400, population: 244692, prixM2: 6500, loyerM2: 65 },
        { id: 'sbata', nom: 'Sbata', lat: 33.5500, lng: -7.5700, population: 101624, prixM2: 7000, loyerM2: 65 },
        { id: 'mers-sultan', nom: 'Mers Sultan', lat: 33.5800, lng: -7.6100, population: 97529, prixM2: 11000, loyerM2: 65 },
        { id: 'al-fida', nom: 'Al-Fida', lat: 33.5700, lng: -7.6000, population: 125777, prixM2: 8000, loyerM2: 65 },
        { id: 'ben-msick', nom: "Ben-M'sick", lat: 33.5600, lng: -7.5600, population: 105549, prixM2: 7000, loyerM2: 65 },
        { id: 'sidi-othmane', nom: 'Sidi Othmane', lat: 33.5800, lng: -7.5500, population: 211894, prixM2: 7500, loyerM2: 65 },
        { id: 'hay-mohammadi', nom: 'Hay Mohammadi', lat: 33.5870, lng: -7.5670, population: 104137, prixM2: 8000, loyerM2: 65 }
      ]
    },
    {
      id: 'FES',
      nom: 'Fès',
      lat: 34.0331, 
      lng: -5.0003,
      zoomBase: 12,
      zones: [
        { id: 'agdal', nom: 'Agdal', lat: 34.0354, lng: -4.9977, population: 144000, prixM2: 7500, loyerM2: 60 },
        { id: 'saiss', nom: 'Saïss', lat: 34.0152, lng: -4.9962, population: 200000, prixM2: 6500, loyerM2: 50 },
        { id: 'zouagha', nom: 'Zouagha', lat: 34.0177, lng: -5.0549, population: 260000, prixM2: 5500, loyerM2: 40 },
        { id: 'mechouar-fes-jdid', nom: 'Méchouar Fès Jdid', lat: 34.0451, lng: -4.9970, population: 35000, prixM2: 6000, loyerM2: 45 }
      ]
    }
  ]
};