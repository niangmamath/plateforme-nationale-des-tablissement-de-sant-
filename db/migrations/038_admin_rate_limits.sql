-- Rate limiting partagé entre toutes les instances serverless Vercel : les Map en mémoire des λ
-- se perdent au cold-start, un attaquant qui tombe sur une nouvelle instance repart à zéro. On
-- centralise les compteurs en DB.
--
-- Modèle "fenêtre fixe par minute" : chaque appel incrémente une ligne (admin_id, route, minute).
-- Lire + écrire tient en un seul INSERT ... ON CONFLICT DO UPDATE RETURNING count. Lignes auto-
-- expirées : on supprime au vol celles de plus d'une heure quand on insère (lazy GC, pas de cron).
--
-- Granularité à la minute : fenêtre glissante exacte serait plus précise mais nettement plus
-- coûteuse (requête sur une plage, groupby). Pour un rate limit "max N par minute", le bucket
-- fixe est suffisant et standard.

CREATE TABLE admin_rate_limits (
  admin_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  route text NOT NULL,
  window_start timestamptz NOT NULL,  -- toujours arrondi à la minute par le code applicatif
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (admin_id, route, window_start)
);

-- Index secondaire pour le lazy GC : purger les lignes de plus de X minutes se fait vite.
CREATE INDEX admin_rate_limits_window_idx ON admin_rate_limits (window_start);
