-- Este script añade las columnas necesarias para almacenar las coordenadas geoespaciales
-- de las atracciones turísticas para el Mapa de Calor Gubernamental.

ALTER TABLE public.attractions
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;
