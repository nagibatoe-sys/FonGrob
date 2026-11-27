begin;
create table public.reward_categories (
 code text primary key check(code ~ '^[a-z][a-z0-9_-]{1,31}$'),
 name text not null check(length(trim(name)) between 2 and 80)
);
insert into public.reward_categories values ('office','Для офиса'),('food','Еда и напитки'),('experience','Впечатления');
create table public.reward_products (
 id uuid primary key default gen_random_uuid(), category_code text not null references public.reward_categories(code),
 name text not null check(length(trim(name)) between 2 and 120),
 description text not null check(length(trim(description)) between 2 and 1000),
 image_url text check(image_url is null or image_url ~ '^https://[^ ]+$'),
 price numeric(16,2) not null check(price > 0 and price <> 'NaN'),
 stock integer not null default 0 check(stock>=0), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.reward_orders (
 id uuid primary key, profile_id uuid not null references public.profiles(id),
 product_id uuid not null references public.reward_products(id),
 price numeric(16,2) not null check(price>0), status text not null default 'ordered'
  check(status in ('ordered','confirmed','issued','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reward_orders_profile_idx on public.reward_orders(profile_id,created_at desc);
alter table public.reward_categories enable row level security;
alter table public.reward_products enable row level security;
alter table public.reward_orders enable row level security;
revoke all on public.reward_categories,public.reward_products,public.reward_orders from public,anon,authenticated;
grant select on public.reward_categories,public.reward_products,public.reward_orders to authenticated;
create policy reward_categories_read on public.reward_categories for select to authenticated using(true);
create policy reward_products_read on public.reward_products for select to authenticated using(active or public.is_admin());
create policy reward_orders_read on public.reward_orders for select to authenticated using(profile_id=auth.uid() or public.is_admin());

create function public.purchase_reward(p_request_id uuid,p_product_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare product public.reward_products; existing public.reward_orders;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_request_id is null or p_product_id is null then raise exception 'Укажите товар и ключ заказа'; end if;
 perform 1 from public.wallets where profile_id=auth.uid() for update;
 select * into existing from public.reward_orders where id=p_request_id;
 if found then
  if existing.profile_id=auth.uid() and existing.product_id=p_product_id then return existing.id; end if;
  raise exception 'Повторный запрос не совпадает';
 end if;
 select * into product from public.reward_products where id=p_product_id for update;
 if not found or not product.active or product.stock<1 then raise exception 'Товар недоступен'; end if;
 update public.wallets set balance=balance-product.price where profile_id=auth.uid() and balance>=product.price;
 if not found then raise exception 'Недостаточно OfficeCoin'; end if;
 update public.reward_products set stock=stock-1 where id=product.id;
 insert into public.reward_orders(id,profile_id,product_id,price) values(p_request_id,auth.uid(),product.id,product.price);
 insert into public.wallet_transactions(profile_id,operation_key,amount) values(auth.uid(),'shop:'||p_request_id,-product.price);
 return p_request_id;
end $$;

create function public.upsert_reward_product(p_id uuid,p_category text,p_name text,p_description text,p_image_url text,p_price numeric,p_stock integer,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare product_id uuid;
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 if p_category is null or not exists(select 1 from public.reward_categories where code=p_category) or length(trim(coalesce(p_name,''))) not between 2 and 120 or length(trim(coalesce(p_description,''))) not between 2 and 1000 or p_price is null or p_price<=0 or p_price='NaN' or p_stock is null or p_stock<0 or (p_image_url is not null and p_image_url !~ '^https://[^ ]+$') then raise exception 'Проверьте поля товара'; end if;
 if p_id is null then
  insert into public.reward_products(category_code,name,description,image_url,price,stock,active)
  values(p_category,trim(p_name),trim(p_description),nullif(trim(p_image_url),''),p_price,p_stock,coalesce(p_active,true)) returning id into product_id;
 else
  update public.reward_products set category_code=p_category,name=trim(p_name),description=trim(p_description),image_url=nullif(trim(p_image_url),''),price=p_price,stock=p_stock,active=coalesce(p_active,true) where id=p_id returning id into product_id;
  if product_id is null then raise exception 'Товар не найден'; end if;
 end if;
 return product_id;
end $$;

create function public.set_reward_order_status(p_order_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.reward_orders;
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 select * into previous from public.reward_orders where id=p_order_id for update;
 if not found then raise exception 'Заказ не найден'; end if;
 if previous.status=p_status then return; end if;
 if not ((previous.status='ordered' and p_status in ('confirmed','cancelled')) or (previous.status='confirmed' and p_status in ('issued','cancelled'))) then raise exception 'Недопустимый переход статуса'; end if;
 if p_status='cancelled' then
  update public.wallets set balance=balance+previous.price where profile_id=previous.profile_id;
  update public.reward_products set stock=stock+1 where id=previous.product_id;
  insert into public.wallet_transactions(profile_id,operation_key,amount) values(previous.profile_id,'shop_refund:'||previous.id,previous.price);
 end if;
 update public.reward_orders set status=p_status,updated_at=clock_timestamp() where id=p_order_id;
end $$;
revoke all on function public.purchase_reward(uuid,uuid),public.upsert_reward_product(uuid,text,text,text,text,numeric,integer,boolean),public.set_reward_order_status(uuid,text) from public;
grant execute on function public.purchase_reward(uuid,uuid),public.upsert_reward_product(uuid,text,text,text,text,numeric,integer,boolean),public.set_reward_order_status(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
