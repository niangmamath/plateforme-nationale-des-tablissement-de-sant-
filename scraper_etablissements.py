import googlemaps
import pandas as pd
import time
import math
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()  # lit le fichier .env à la racine du projet

# === CONFIGURATION PAR SPÉCIALITÉ ===
# Clé = valeur EXACTE de la colonne "categorie" en base (ne pas modifier sans vérifier la base).
SPECIALITES_CONFIG = {
    "Ophtalmologie": {
        "requete": "ophtalmologue",
        "inclus": ["ophtalmo", "œil", "oeil", "yeux", "vision", "rétine"],
        "exclus": ["dermato", "généraliste", "général", "cardio", "pédiat", "dent", "neuro", "ortho",
                   "psy", "gynéco", "uro", "gastro", "kiné", "chirurgien", "plastique", "esthéticienne",
                   "spa", "massage", "coiffure", "beauté", "onglerie", "pharma", "laboratoire", "radio",
                   "opticien", "optique"],
        "types_requis": ["doctor", "health"],
        "fichier": "ophtalmologues_{ville}_nouveaux.xlsx",
    },
    "Dermatologue": {
        "requete": "dermatologue",
        "inclus": ["dermato", "peau", "vénérologie", "vénéréologie", "laser"],
        "exclus": ["généraliste", "général", "cardio", "pédiat", "dent", "ophtalmo", "neuro", "ortho",
                   "psy", "gynéco", "uro", "gastro", "kiné", "chirurgien", "plastique", "esthéticienne",
                   "spa", "massage", "coiffure", "beauté", "onglerie", "pharma", "laboratoire", "radio"],
        "types_requis": ["doctor", "health"],
        "fichier": "dermatologues_{ville}_nouveaux.xlsx",
    },
    "Clinique Privée": {
        "requete": "clinique privée",
        "inclus": ["clinique", "polyclinique"],
        "exclus": ["dentaire", "vétérinaire", "beauté", "esthétique", "spa", "onglerie", "coiffure"],
        "types_requis": ["hospital", "health"],
        "fichier": "cliniques_{ville}_nouveaux.xlsx",
    },
}

VILLES_RECHERCHE = ["Casablanca", "Fès"]

# === BASE LOCALE (lecture seule — jamais Supabase, jamais d'écriture) ===
DATABASE_URL_LOCAL = os.environ.get('DATABASE_URL_LOCAL')
if not DATABASE_URL_LOCAL:
    raise SystemExit("DATABASE_URL_LOCAL n'est pas définie dans .env.")


def charger_zones_par_ville():
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


def charger_place_ids_existants():
    conn = psycopg2.connect(DATABASE_URL_LOCAL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT place_id FROM etablissements WHERE place_id IS NOT NULL")
            return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()


def trouver_arrondissement_le_plus_proche(lat, lng, ville, zones_par_ville):
    if not lat or not lng:
        return ""
    centroides = zones_par_ville.get(ville, [])
    if not centroides:
        return ""
    distance_min = float('inf')
    arrondissement_proche = ""
    for nom_arrondissement, c_lat, c_lng in centroides:
        dist = math.sqrt((lat - c_lat) ** 2 + (lng - c_lng) ** 2)
        if dist < distance_min:
            distance_min = dist
            arrondissement_proche = nom_arrondissement
    return arrondissement_proche


def extraire_specialite(nom_specialite, config, zones_par_ville, place_ids_existants, gmaps):
    donnees = []
    for ville in VILLES_RECHERCHE:
        query = f"{config['requete']} {ville}, Maroc"
        print(f"Recherche en cours : {query}")

        places_result = gmaps.places(query=query)

        while True:
            for place in places_result.get('results', []):
                nom_etablissement = place.get('name', '')
                nom_lower = nom_etablissement.lower()

                if any(exclu in nom_lower for exclu in config['exclus']):
                    continue
                types_google = place.get('types', [])
                if not any(t in types_google for t in config['types_requis']):
                    continue
                if not any(inclus in nom_lower for inclus in config['inclus']):
                    continue

                place_id = place.get('place_id')
                lat = place.get('geometry', {}).get('location', {}).get('lat')
                lng = place.get('geometry', {}).get('location', {}).get('lng')

                donnees.append({
                    "Nom de l'établissement": nom_etablissement,
                    "Adresse": place.get('formatted_address', ''),
                    "Arrondissement": trouver_arrondissement_le_plus_proche(lat, lng, ville, zones_par_ville),
                    "Ville": ville,
                    "Type d'établissement": nom_specialite,
                    "Place ID": place_id,
                    "Longitude": lng,
                    "Latitude": lat,
                    "Source": "Google Maps",
                })

            next_page_token = places_result.get('next_page_token')
            if not next_page_token:
                break
            print("Récupération de la page suivante...")
            time.sleep(2)
            places_result = gmaps.places(query=query, page_token=next_page_token)

    df = pd.DataFrame(donnees)
    total = len(df)
    df_nouveaux = df[~df['Place ID'].isin(place_ids_existants)].reset_index(drop=True) if total else df
    nb_doublons = total - len(df_nouveaux)

    nom_fichier = config['fichier'].format(ville="casa_fes")
    df_nouveaux.to_excel(nom_fichier, index=False, engine='openpyxl')

    print(f"[{nom_specialite}] Extraits : {total} | Déjà en base (écartés) : {nb_doublons} | "
          f"Vraiment nouveaux : {len(df_nouveaux)} -> {nom_fichier}")
    return df_nouveaux


def main():
    API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY')
    if not API_KEY:
        raise SystemExit("GOOGLE_PLACES_API_KEY n'est pas définie. Configurez-la avant de lancer ce script.")
    gmaps = googlemaps.Client(key=API_KEY)

    zones_par_ville = charger_zones_par_ville()
    for ville, zones in zones_par_ville.items():
        print(f"Zones chargées depuis la base pour {ville} : {len(zones)}")

    place_ids_existants = charger_place_ids_existants()
    print(f"Établissements déjà en base (place_id connus) : {len(place_ids_existants)}\n")

    for nom_specialite, config in SPECIALITES_CONFIG.items():
        extraire_specialite(nom_specialite, config, zones_par_ville, place_ids_existants, gmaps)


if __name__ == "__main__":
    main()
