import googlemaps
import pandas as pd
import time
import math
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()  # lit le fichier .env à la racine du projet

# === ZONES (CENTROÏDES) CHARGÉES DEPUIS LA BASE — plus de dictionnaire codé en dur ===
# Phase de test : on lit explicitement la base LOCALE (DATABASE_URL_LOCAL), jamais Supabase,
# pour ne rien risquer sur les données de production pendant qu'on valide l'approche.
DATABASE_URL_LOCAL = os.environ.get('DATABASE_URL_LOCAL')
if not DATABASE_URL_LOCAL:
    raise SystemExit("DATABASE_URL_LOCAL n'est pas définie dans .env.")

def charger_zones_par_ville():
    """Retourne { 'Casablanca': [(nom, lat, lng), ...], 'Fès': [...] } depuis la base locale."""
    conn = psycopg2.connect(DATABASE_URL_LOCAL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT v.nom AS ville, z.nom, z.lat, z.lng
                FROM zones z
                JOIN villes v ON v.id = z.ville_id
                WHERE z.statut = 'publie'
                ORDER BY v.nom, z.nom
            """)
            rows = cur.fetchall()
    finally:
        conn.close()

    zones_par_ville = {}
    for ville, nom, lat, lng in rows:
        zones_par_ville.setdefault(ville, []).append((nom, float(lat), float(lng)))
    return zones_par_ville

ZONES_PAR_VILLE = charger_zones_par_ville()
for ville, zones in ZONES_PAR_VILLE.items():
    print(f"Zones chargées depuis la base pour {ville} : {len(zones)} ({', '.join(z[0] for z in zones)})")

def charger_place_ids_existants():
    """Lecture seule (SELECT) : place_id déjà présents en base, pour dédoublonner en sortie.
    N'écrit jamais rien en base."""
    conn = psycopg2.connect(DATABASE_URL_LOCAL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT place_id FROM etablissements WHERE place_id IS NOT NULL")
            return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()

PLACE_IDS_EXISTANTS = charger_place_ids_existants()
print(f"Établissements déjà en base (place_id connus) : {len(PLACE_IDS_EXISTANTS)}")

# === FONCTION DE CALCUL DE DISTANCE ===
def trouver_arrondissement_le_plus_proche(lat, lng, ville):
    if not lat or not lng:
        return ""

    centroides = ZONES_PAR_VILLE.get(ville, [])
    if not centroides:
        return ""

    distance_min = float('inf')
    arrondissement_proche = ""

    for nom_arrondissement, c_lat, c_lng in centroides:
        dist = math.sqrt((lat - c_lat)**2 + (lng - c_lng)**2)
        if dist < distance_min:
            distance_min = dist
            arrondissement_proche = nom_arrondissement

    return arrondissement_proche

# === SCRIPT GOOGLE MAPS ===
# Clé API lue depuis une variable d'environnement (jamais en dur dans le code) :
#   PowerShell : $env:GOOGLE_PLACES_API_KEY = "votre_cle"
#   Bash       : export GOOGLE_PLACES_API_KEY="votre_cle"
API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY')
if not API_KEY:
    raise SystemExit("GOOGLE_PLACES_API_KEY n'est pas définie. Configurez-la avant de lancer ce script.")

gmaps = googlemaps.Client(key=API_KEY)

villes_recherche = ['Casablanca, Maroc', 'Fès, Maroc']
requete_cible = 'ophtalmologue'
donnees_extraites = []

mots_cles_inclus = ['ophtalmo', 'œil', 'oeil', 'yeux', 'vision', 'rétine']
mots_cles_exclus = ['dermato', 'généraliste', 'général', 'cardio', 'pédiat', 'dent', 'neuro', 'ortho', 'psy', 'gynéco', 'uro', 'gastro', 'kiné', 'chirurgien', 'plastique', 'esthéticienne', 'spa', 'massage', 'coiffure', 'beauté', 'onglerie', 'pharma', 'laboratoire', 'radio', 'opticien', 'optique']

for ville_cible in villes_recherche:
    query = f"{requete_cible} {ville_cible}"
    print(f"Recherche en cours : {query}")

    places_result = gmaps.places(query=query)
    nom_ville_propre = "Casablanca" if "Casablanca" in ville_cible else "Fès"

    while True:
        for place in places_result.get('results', []):
            nom_etablissement = place.get('name', '')
            nom_lower = nom_etablissement.lower()

            # --- FILTRAGE STRICT ---
            if any(exclu in nom_lower for exclu in mots_cles_exclus):
                continue
            types_google = place.get('types', [])
            if 'doctor' not in types_google and 'health' not in types_google:
                continue
            if not any(inclus in nom_lower for inclus in mots_cles_inclus):
                continue

            place_id = place.get('place_id')
            lat = place.get('geometry', {}).get('location', {}).get('lat')
            lng = place.get('geometry', {}).get('location', {}).get('lng')
            adresse_complete = place.get('formatted_address', '')

            arrondissement_calcule = trouver_arrondissement_le_plus_proche(lat, lng, nom_ville_propre)

            donnees_extraites.append({
                "Nom de l'établissement": nom_etablissement,
                "Adresse": adresse_complete,
                "Arrondissement": arrondissement_calcule,
                "Ville": nom_ville_propre,
                "Type d'établissement": "Ophtalmologie",
                "Place ID": place_id,
                "Longitude": lng,
                "Latitude": lat,
                "Source": "Google Maps"
            })

        next_page_token = places_result.get('next_page_token')
        if not next_page_token:
            break

        print("Récupération de la page suivante...")
        time.sleep(2)
        places_result = gmaps.places(query=query, page_token=next_page_token)

df = pd.DataFrame(donnees_extraites)

# --- DÉDOUBLONNAGE (lecture seule, aucune écriture en base) ---
total_extraits = len(df)
df_nouveaux = df[~df['Place ID'].isin(PLACE_IDS_EXISTANTS)].reset_index(drop=True)
nb_doublons = total_extraits - len(df_nouveaux)

nom_fichier = 'ophtalmologues_casa_fes_test_zones_bdd.xlsx'
df_nouveaux.to_excel(nom_fichier, index=False, engine='openpyxl')

print(f"\nExtraits : {total_extraits} | Déjà en base (écartés) : {nb_doublons} | Vraiment nouveaux : {len(df_nouveaux)}")
print(f"Fichier écrit : {nom_fichier} ({len(df_nouveaux)} lignes)")
