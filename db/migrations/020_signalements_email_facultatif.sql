-- L'email du rapporteur devient facultatif : l'exiger décourage les signalements (friction) et
-- n'apporte pas de garantie puisqu'il n'est de toute façon pas vérifié à l'envoi. Sans email,
-- l'équipe traite le signalement mais ne peut simplement pas recontacter la personne.
ALTER TABLE signalements ALTER COLUMN email DROP NOT NULL;

-- Quand le problème est de type "autre", texte libre saisi par l'utilisateur pour le préciser
-- (la liste fermée ne peut pas couvrir tous les cas). Vide pour tous les autres types.
ALTER TABLE signalements ADD COLUMN type_probleme_precision text;
ALTER TABLE signalements ADD CONSTRAINT signalements_precision_coherence
  CHECK (type_probleme_precision IS NULL OR type_probleme = 'autre');
