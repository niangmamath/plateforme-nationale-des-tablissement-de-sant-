-- Doublons de zones par variante orthographique/translittération (pas seulement accents/casse
-- cette fois — détectés par distance de Levenshtein sur l'ensemble de la table, voir conversation).
-- Alignés sur l'orthographe majoritaire déjà en base pour chaque zone ; "Al-Fida" confirmé comme
-- nom canonique via la table zones (HCP) en plus d'être la variante majoritaire.
--
-- Deux paires détectées comme "proches" par l'algorithme ne sont PAS fusionnées ici car ce sont de
-- vrais quartiers distincts, pas des doublons : "Derb Sultan" et "Mers Sultan" (deux quartiers
-- différents de Casablanca), "Zenata" et "Zenith" (Zenata est un vrai lieu-dit, "Zenith" semble
-- être une adresse/nom de résidence isolé, pas une zone à fusionner sans vérification).
UPDATE etablissements SET quartier = 'Al-Fida' WHERE ville = 'Casablanca' AND quartier IN ('Al Fida', 'El Fida');
UPDATE etablissements SET quartier = 'Beauséjour' WHERE ville = 'Casablanca' AND quartier = 'Beau séjour';
UPDATE etablissements SET quartier = 'Ben-M''sick' WHERE ville = 'Casablanca' AND quartier = 'Ben M''sick';
UPDATE etablissements SET quartier = 'Champs de Courses (Ville Nouvelle)' WHERE ville = 'Fès' AND quartier = 'Champs de Course(Ville Nouvelle)';
UPDATE etablissements SET quartier = 'Jnane El Ward' WHERE ville = 'Fès' AND quartier = 'Jnan El Ward';
UPDATE etablissements SET quartier = 'Mechouar Kasbah' WHERE ville = 'Marrakech' AND quartier = 'Méchouar-Kasba';
UPDATE etablissements SET quartier = 'Agdal-Riyad' WHERE ville = 'Rabat' AND quartier = 'Agdal-Ryad';
UPDATE etablissements SET quartier = 'Bni Makada' WHERE ville = 'Tanger' AND quartier = 'Béni Makada';
