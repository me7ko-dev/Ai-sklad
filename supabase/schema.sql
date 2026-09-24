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
  created_at timestamptz not null default now()
);

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

revoke execute on function record_movement(uuid, text, numeric, text, text)
  from public, anon, authenticated;

-- Изрично право за сървъра на приложението (в някои нови проекти не се дава само).
grant usage on schema public to service_role;
grant select, insert, update, delete on products, stock_movements to service_role;
grant execute on function record_movement(uuid, text, numeric, text, text) to service_role;
