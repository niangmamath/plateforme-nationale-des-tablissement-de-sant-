-- 72 fiches (import manuel du 2026-08-05 via scraper_etablissements.py, source "Google Maps" --
-- distinct du pipeline automatisé "Google Maps (automatisé)") avaient quartier = '' : le script
-- n'exporte qu'une colonne "Arrondissement" (zone HCP la plus proche), pas de "Quartier", et ce
-- champ obligatoire a été laissé vide à l'import.
--
-- Valeurs reconstituées par géocodage inverse Google (lat/lng déjà en base -> sous-localité/
-- quartier réel, voir scratchpad geocode72.cjs de cette session) pour 48 fiches ; les 24 fiches où
-- Google ne renvoie aucune sous-localité à ces coordonnées précises reprennent la zone HCP la plus
-- proche déjà calculée dans arrondissement (même repli que le pipeline automatisé normal).
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-334' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Sidi Othmane' WHERE id = 'etab-335' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'El Fida' WHERE id = 'etab-336' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Les Hopitaux' WHERE id = 'etab-337' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-338' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-339' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Sidi Belyout' WHERE id = 'etab-340' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Sidi Belyout' WHERE id = 'etab-341' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-342' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Mohammadi' WHERE id = 'etab-343' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Les Hopitaux' WHERE id = 'etab-344' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-345' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-346' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-347' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-348' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-349' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-350' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-351' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-352' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-353' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'El Maarif' WHERE id = 'etab-354' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-355' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-356' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Roches Noires' WHERE id = 'etab-357' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-358' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-359' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'El Maarif' WHERE id = 'etab-360' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Sidi Belyout' WHERE id = 'etab-361' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-362' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Fonciere' WHERE id = 'etab-363' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Fonciere' WHERE id = 'etab-364' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-365' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-366' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-367' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-368' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Aïn Chock' WHERE id = 'etab-369' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Aïn Sebaâ' WHERE id = 'etab-370' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-371' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-372' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Mers Sultan' WHERE id = 'etab-373' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-374' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Habous' WHERE id = 'etab-375' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Maarif' WHERE id = 'etab-376' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-377' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Les Hopitaux' WHERE id = 'etab-378' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-379' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Hay Hassani' WHERE id = 'etab-380' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-381' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-382' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-383' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-384' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-385' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-386' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-387' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-388' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-389' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-390' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-391' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-392' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-393' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-394' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-395' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-396' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-397' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-398' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-399' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-400' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Saïss' WHERE id = 'etab-401' AND quartier = ''; -- repli_arrondissement
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-402' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-403' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Ville Nouvelle' WHERE id = 'etab-404' AND quartier = ''; -- geocodage
UPDATE etablissements SET quartier = 'Saïss' WHERE id = 'etab-405' AND quartier = ''; -- repli_arrondissement
