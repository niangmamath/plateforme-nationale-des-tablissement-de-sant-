-- Doublons de zones causés par des variantes d'accents/majuscules entre lots d'import (certains
-- préexistants, "Les Hopitaux"/"Maarif" introduits par la migration 030 elle-même — comparés entre
-- eux mais pas contre l'orthographe déjà en base). On aligne sur l'orthographe majoritaire déjà
-- utilisée pour chaque zone plutôt que d'imposer une règle uniforme (parfois la majorité a
-- l'accent, parfois non — ex. "Marrakech-Medina" sans accent est majoritaire malgré l'orthographe
-- correcte avec accent).
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE ville = 'Casablanca' AND quartier = 'Ain Chock';
UPDATE etablissements SET quartier = 'Les Hôpitaux' WHERE ville = 'Casablanca' AND quartier = 'Les Hopitaux';
UPDATE etablissements SET quartier = 'Maârif' WHERE ville = 'Casablanca' AND quartier = 'Maarif';
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE ville = 'Fès' AND quartier = 'Ville nouvelle';
UPDATE etablissements SET quartier = 'Guéliz' WHERE ville = 'Marrakech' AND quartier = 'Gueliz';
UPDATE etablissements SET quartier = 'Marrakech-Medina' WHERE ville = 'Marrakech' AND quartier = 'Marrakech-Médina';
