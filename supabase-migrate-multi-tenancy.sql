-- EPIC 1.1: Migración a Multi-Tenancy

-- 1. Crear tabla de Municipios
CREATE TABLE IF NOT EXISTS public.municipalities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Municipalities are viewable by everyone" ON municipalities;
CREATE POLICY "Municipalities are viewable by everyone"
  ON municipalities FOR SELECT
  USING (true);

-- 2. Modificar tabla Profiles
-- Agregamos rol (user, govt, superadmin) y municipality_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL;

-- 3. Modificar tabla Attractions
-- Agregamos municipality_id
ALTER TABLE public.attractions
  ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE;

-- 4. Modificar tabla User Badges (Opcional, pero util para consultas rapidas si es necesario)
-- No agregamos municipality_id directamente a badges ya que heredan indirectamente de attractions.

-- 5. Configurar Row Level Security (RLS) en Profiles
-- Permitir a usuarios ver perfiles públicos, y al govt ver usuarios de su municipio
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING (true);

-- 6. Configurar RLS en Attractions
-- Select: Todos pueden ver atracciones.
-- Insert/Update/Delete: Solo admin/superadmin.
DROP POLICY IF EXISTS "Attractions are viewable by everyone." ON attractions;
CREATE POLICY "Attractions are viewable by everyone."
  ON attractions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Govt can insert attractions in their municipality" ON attractions;
CREATE POLICY "Govt can insert attractions in their municipality"
  ON attractions FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('govt', 'superadmin'))
    AND 
    (municipality_id = (SELECT municipality_id FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin')
  );

DROP POLICY IF EXISTS "Govt can update attractions in their municipality" ON attractions;
CREATE POLICY "Govt can update attractions in their municipality"
  ON attractions FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('govt', 'superadmin'))
    AND 
    (municipality_id = (SELECT municipality_id FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin')
  );

DROP POLICY IF EXISTS "Govt can delete attractions in their municipality" ON attractions;
CREATE POLICY "Govt can delete attractions in their municipality"
  ON attractions FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('govt', 'superadmin'))
    AND 
    (municipality_id = (SELECT municipality_id FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin')
  );

-- 7. Modificar la funcion handle_new_user de Supabase para ser infalible
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta jsonb;
BEGIN
  meta := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id, 
    new.email, 
    meta->>'full_name', 
    meta->>'avatar_url',
    COALESCE(meta->>'role', 'user')
  );
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla algo, no bloqueamos el 200 OK de Supabase Auth
    RAISE LOG 'Error en handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;

-- 8. Crear tabla circuits
CREATE TABLE IF NOT EXISTS public.circuits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE,
  master_badge_id text, -- Opcional, si hay una recompensa especial
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- 9. Crear tabla circuit_attractions (Pivote)
CREATE TABLE IF NOT EXISTS public.circuit_attractions (
  circuit_id uuid REFERENCES public.circuits(id) ON DELETE CASCADE,
  attraction_id text REFERENCES public.attractions(id) ON DELETE CASCADE,
  PRIMARY KEY (circuit_id, attraction_id)
);

ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_attractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circuits are viewable by everyone" ON circuits;
CREATE POLICY "Circuits are viewable by everyone"
  ON circuits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Govt can insert/update circuits in their municipality" ON circuits;
CREATE POLICY "Govt can insert/update circuits in their municipality"
  ON circuits FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('govt', 'superadmin'))
    AND 
    (municipality_id = (SELECT municipality_id FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin')
  );

DROP POLICY IF EXISTS "Circuit attractions are viewable by everyone" ON circuit_attractions;
CREATE POLICY "Circuit attractions are viewable by everyone"
  ON circuit_attractions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Govt can manage circuit attractions" ON circuit_attractions;
CREATE POLICY "Govt can manage circuit attractions"
  ON circuit_attractions FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('govt', 'superadmin'))
    AND 
    (
      (SELECT municipality_id FROM circuits WHERE id = circuit_id) = (SELECT municipality_id FROM profiles WHERE id = auth.uid()) 
      OR 
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    )
  );
