-- Este script eliminará todas las cuentas "invitadas / anónimas" huérfanas
-- que no tienen un email asociado y nunca reclamaron una insignia.
--
-- NOTA: Como la tabla public.profiles tiene Foreign Key hacia auth.users 
-- con comportamiento "ON DELETE CASCADE", al borrar el usuario de auth, 
-- automáticamente desaparecerá de profiles también.

DELETE FROM auth.users 
WHERE id IN (
  SELECT id FROM public.profiles 
  WHERE role = 'tourist' 
    AND email IS NULL 
    AND id::text NOT IN (SELECT DISTINCT user_id FROM public.user_badges WHERE user_id IS NOT NULL)
);
