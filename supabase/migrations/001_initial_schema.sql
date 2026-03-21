-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ==========================================
-- TABLA: proyectos
-- ==========================================
create table public.proyectos (
  id uuid default uuid_generate_v4() primary key,
  titulo text not null,
  descripcion text,
  categoria text,
  imagen_url text,
  link text,
  creado_en timestamp with time zone default timezone('utc'::text, now())
);

-- RLS para proyectos: Todos pueden leer, sólo admin puede modificar (desde Dashboard o BD directamente)
alter table public.proyectos enable row level security;

create policy "Lectura pública de proyectos" 
  on public.proyectos for select 
  to public
  using (true);

-- ==========================================
-- TABLA: contactos
-- ==========================================
create table public.contactos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  email text not null,
  mensaje text not null,
  creado_en timestamp with time zone default timezone('utc'::text, now())
);

-- RLS para contactos: Cualquiera puede insertar (anon/public), pero NADIE (excepto admin autenticado) puede leer
alter table public.contactos enable row level security;

create policy "Permitir inserción pública de contactos" 
  on public.contactos for insert 
  to public
  with check (true);

create policy "Permitir lectura de contactos sólo a usuarios autenticados" 
  on public.contactos for select 
  to authenticated
  using (true); 

-- ==========================================
-- TABLA: herramientas_stats
-- ==========================================
create table public.herramientas_stats (
  id uuid default uuid_generate_v4() primary key,
  nombre_herramienta text not null unique,
  uso_count integer default 0,
  actualizado_en timestamp with time zone default timezone('utc'::text, now())
);

-- RLS para herramientas_stats: Cualquiera puede leer y actualizar el contador
alter table public.herramientas_stats enable row level security;

create policy "Lectura pública de herramientas_stats" 
  on public.herramientas_stats for select 
  to public
  using (true);

-- Permitimos a public actualizar para que cualquier visitante sume +1 sin estar logueado
create policy "Actualización pública de herramientas_stats" 
  on public.herramientas_stats for update 
  to public
  using (true)
  with check (true);

-- ==========================================
-- PROCEDIMIENTO ALMACENADO (RPC)
-- ==========================================
-- Función para incrementar el uso de forma segura y atómica desde el frontend
create or replace function incrementar_uso_herramienta(herramienta_nombre text)
returns void
language plpgsql security definer
as $$
begin
  insert into public.herramientas_stats (nombre_herramienta, uso_count)
  values (herramienta_nombre, 1)
  on conflict (nombre_herramienta)
  do update set uso_count = herramientas_stats.uso_count + 1,
                actualizado_en = timezone('utc'::text, now());
end;
$$;
