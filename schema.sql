-- ============================================================
-- CIUP Fast Track — Supabase schema
-- Run this in your Supabase project:
--   Dashboard → SQL Editor → New query → paste & Run
--
-- TIP: In Auth → Providers → Email, disable "Confirm email"
-- during development so sign-ups work instantly.
-- ============================================================

-- ── 1. houses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS houses (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "houses_public_select"
  ON houses FOR SELECT USING (true);

INSERT INTO houses (name) VALUES
  ('Maison du Brésil'),
  ('Collège d''Espagne'),
  ('Maison de l''Argentine'),
  ('Fondation Biermans-Lapôtre'),
  ('Maison des Étudiants de l''Asie du Sud-Est'),
  ('Maison de l''Inde'),
  ('Maison du Japon'),
  ('Collège Franco-Britannique'),
  ('Maison de Cuba'),
  ('Maison de la Tunisie'),
  ('Maison du Portugal'),
  ('Maison de la Suède'),
  ('Maison de Mexico'),
  ('Maison de Norvège'),
  ('Maison des Provinces de France'),
  ('Maison de l''Iran'),
  ('Maison de la Grèce'),
  ('Maison de l''Italie')
ON CONFLICT (name) DO NOTHING;


-- ── 2. contacts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT,
  description   TEXT,
  subtitle      TEXT,
  hours         TEXT,
  response_time TEXT,
  email         TEXT,
  phone         TEXT,
  location      TEXT,
  languages     TEXT,
  always_open   BOOLEAN NOT NULL DEFAULT FALSE,
  whole_campus  BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_public_select"
  ON contacts FOR SELECT USING (true);

INSERT INTO contacts
  (id, name, role, description, subtitle, hours, response_time, email, phone, location, languages, always_open, whole_campus)
VALUES
  ('maintenance',
   'Maintenance team', 'Maintenance',
   'Handles heating, hot water, plumbing, electrical faults and broken equipment in rooms and shared spaces.',
   'heating, plumbing, electrical, repairs',
   'Mon–Fri, 9:00–17:00', '1 working day',
   'maintenance@house.ciup.fr', '+33 1 45 89 00 10',
   'Ground floor, east wing', 'French, English',
   FALSE, FALSE),

  ('reception',
   'Reception desk', 'Reception',
   'First point of contact for administrative enquiries, parcels, lost property, key collection and general requests.',
   'can log your request if maintenance is closed',
   'Mon–Sun, 8:00–22:00', 'Same day',
   'reception@house.ciup.fr', '+33 1 45 89 00 00',
   'Main entrance lobby', 'French, English',
   FALSE, FALSE),

  ('admin',
   'House administration', 'House administration',
   'Manages rent, payments, contracts, stay extensions and administrative matters for residents.',
   'rent, payments, contracts, extensions',
   'Mon–Fri, 9:00–17:00', '2 working days',
   'admin@house.ciup.fr', '+33 1 45 89 00 20',
   'First floor, administration office', 'French, English',
   FALSE, FALSE),

  ('director',
   'House director', 'House director',
   'Oversees all aspects of the house. Contact for serious complaints, noise issues or matters not handled by other staff.',
   'noise complaints, serious issues, escalations',
   'Mon–Fri, 10:00–17:00', '2–3 working days',
   'director@house.ciup.fr', '+33 1 45 89 00 05',
   'Second floor, director''s office', 'French',
   FALSE, FALSE),

  ('it',
   'IT support', 'IT support',
   'Handles wifi, internet connectivity, network access and technical issues in rooms and shared spaces.',
   'wifi, internet, network, tech issues',
   'Mon–Fri, 9:00–18:00', '1 working day',
   'it@house.ciup.fr', '+33 1 45 89 00 30',
   'Ground floor, IT office', 'French, English',
   FALSE, FALSE),

  ('housekeeping',
   'Housekeeping', 'Housekeeping',
   'Responsible for cleaning of rooms, corridors and shared spaces including kitchens and common areas.',
   'cleaning, kitchen, shared spaces',
   'Mon–Sat, 7:00–15:00', 'Same day',
   'housekeeping@house.ciup.fr', '+33 1 45 89 00 40',
   'Basement, housekeeping office', 'French',
   FALSE, FALSE),

  ('security',
   'CIUP security (24/7)', 'Security',
   'Campus-wide security available 24 hours a day, 7 days a week. For urgent issues outside opening hours only.',
   'only for urgent issues outside opening hours',
   'Always open', NULL,
   NULL, '+33 1 44 16 65 00',
   'Main CIUP gate, 17 Boulevard Jourdan', 'French, English',
   TRUE, TRUE)

ON CONFLICT (id) DO NOTHING;


-- ── 3. profiles (extends auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name  TEXT NOT NULL,
  house TEXT NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own_select"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_insert"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE USING (auth.uid() = id);
