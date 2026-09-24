-- Гласов склад — структура на базата данни.
-- Пуска се веднъж в Supabase → SQL Editor. Безопасно е да се пусне и повторно.

-- Продукти и текущите им наличности.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'бр.',
  quantity numeric(12, 3) not null default 0,
  -- Под или равно на това количество продуктът се показва в червено.
  min_quantity numeric(12, 3) not null default 0,
  supplier text,
  -- Колко броя има в един кашон/стек (за „дойдоха 3 кашона“).
  pack_size numeric(12, 3),
  -- Други имена, с които хората наричат продукта (ще се ползват за гласа).
  aliases text[] not null default '{}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_name_unique
  on products (lower(name)) where not archived;

-- Всяка промяна на наличност: продажба, доставка или корекция (преброяване).
create table if not exists stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references products (id) on delete cascade,
  kind text not null check (kind in ('sale', 'delivery', 'adjustment')),
  quantity_change numeric(12, 3) not null,
  quantity_after numeric(12, 3) not null,
  source text not null default 'manual' check (source in ('manual', 'voice')),
  note text,
  created_at timestamptz not null default now(),
  -- Попълва се, когато записът е отменен от историята.
  undone_at timestamptz
);

-- За бази, създадени с по-стара версия на този файл.
alter table products add column if not exists pack_size numeric(12, 3);
alter table stock_movements add column if not exists undone_at timestamptz;

create index if not exists stock_movements_created_idx
  on stock_movements (created_at desc);
create index if not exists stock_movements_product_idx
  on stock_movements (product_id, created_at desc);

-- Достъп само от сървъра на приложението (с тайния ключ).
-- Без правила (policies) публичният ключ не може да чете или пише нищо.
alter table products enable row level security;
alter table stock_movements enable row level security;

-- Записва движение и обновява наличността в една стъпка.
--   sale       → p_amount е продаденото количество (изважда се)
--   delivery   → p_amount е доставеното количество (добавя се)
--   adjustment → p_amount е точното преброено количество
create or replace function record_movement(
  p_product_id uuid,
  p_kind text,
  p_amount numeric,
  p_source text default 'manual',
  p_note text default null
)
returns products
language plpgsql
set search_path = public
as $$
declare
  v_product products;
  v_change numeric;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'Невалидно количество';
  end if;
  if p_kind in ('sale', 'delivery') and p_amount = 0 then
    raise exception 'Количеството трябва да е повече от нула';
  end if;

  select * into v_product
  from products
  where id = p_product_id and not archived
  for update;

  if not found then
    raise exception 'Продуктът не е намерен';
  end if;

  v_change := case p_kind
    when 'sale' then -p_amount
    when 'delivery' then p_amount
    when 'adjustment' then p_amount - v_product.quantity
  end;

  if v_change is null then
    raise exception 'Невалиден вид движение';
  end if;

  update products
  set quantity = quantity + v_change, updated_at = now()
  where id = p_product_id
  returning * into v_product;

  insert into stock_movements (product_id, kind, quantity_change, quantity_after, source, note)
  values (p_product_id, p_kind, v_change, v_product.quantity, p_source, p_note);

  return v_product;
end;
$$;

-- Записва няколко движения наведнъж (от гласа): или всички, или нито едно.
create or replace function record_movements(
  p_items jsonb,
  p_source text default 'voice',
  p_note text default null
)
returns setof products
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Няма какво да се запише';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    return next record_movement(
      (v_item ->> 'product_id')::uuid,
      v_item ->> 'kind',
      (v_item ->> 'amount')::numeric,
      p_source,
      p_note
    );
  end loop;
end;
$$;

-- Отменя грешен запис: връща наличността и отбелязва записа като отменен.
create or replace function undo_movement(p_movement_id bigint)
returns products
language plpgsql
set search_path = public
as $$
declare
  v_movement stock_movements;
  v_product products;
begin
  select * into v_movement
  from stock_movements
  where id = p_movement_id
  for update;

  if not found then
    raise exception 'Записът не е намерен';
  end if;
  if v_movement.undone_at is not null then
    raise exception 'Записът вече е отменен';
  end if;

  update products
  set quantity = quantity - v_movement.quantity_change, updated_at = now()
  where id = v_movement.product_id
  returning * into v_product;

  update stock_movements set undone_at = now() where id = p_movement_id;

  return v_product;
end;
$$;

-- Обобщение по продукти за период (за „днес“ и „тази седмица“).
create or replace function movement_summary(p_from timestamptz, p_to timestamptz default now())
returns table (
  product_id uuid,
  name text,
  unit text,
  sold numeric,
  delivered numeric,
  adjusted numeric,
  movements bigint
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.unit,
    coalesce(sum(-m.quantity_change) filter (where m.kind = 'sale'), 0),
    coalesce(sum(m.quantity_change) filter (where m.kind = 'delivery'), 0),
    coalesce(sum(m.quantity_change) filter (where m.kind = 'adjustment'), 0),
    count(*)
  from stock_movements m
  join products p on p.id = m.product_id
  where m.created_at >= p_from and m.created_at < p_to and m.undone_at is null
  group by p.id, p.name, p.unit
  order by 4 desc, p.name;
$$;

-- Функциите са достъпни само за сървъра на приложението.
revoke execute on function record_movement(uuid, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function record_movements(jsonb, text, text) from public, anon, authenticated;
revoke execute on function undo_movement(bigint) from public, anon, authenticated;
revoke execute on function movement_summary(timestamptz, timestamptz) from public, anon, authenticated;

-- Изрично право за сървъра на приложението (в някои нови проекти не се дава само).
grant usage on schema public to service_role;
grant select, insert, update, delete on products, stock_movements to service_role;
grant execute on function record_movement(uuid, text, numeric, text, text) to service_role;
grant execute on function record_movements(jsonb, text, text) to service_role;
grant execute on function undo_movement(bigint) to service_role;
grant execute on function movement_summary(timestamptz, timestamptz) to service_role;
