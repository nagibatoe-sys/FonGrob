begin;

alter table public.profiles add column accent_code text not null default 'standard'
  check (accent_code in ('standard','gold','ice'));
alter table public.reward_products add column cosmetic_code text
  check (cosmetic_code in ('gold','ice'));
create unique index reward_products_cosmetic_code_key on public.reward_products(cosmetic_code)
  where cosmetic_code is not null;

insert into public.reward_categories(code,name) values ('appearance','Оформление')
  on conflict (code) do nothing;
insert into public.reward_products(id,category_code,name,description,price,stock,active,cosmetic_code)
values
 ('a10c0000-0000-4000-8000-000000000001','appearance','Золотой акцент','Тёплое золото для навигации, кнопок и личного кабинета.',240,999999,true,'gold'),
 ('a10c0000-0000-4000-8000-000000000002','appearance','Ледяной акцент','Холодный голубой акцент для навигации, кнопок и личного кабинета.',240,999999,true,'ice')
on conflict (id) do nothing;

create or replace function public.purchase_reward(p_request_id uuid,p_product_id uuid) returns uuid
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
 if product.cosmetic_code is not null and exists(
   select 1 from public.reward_orders where profile_id=auth.uid() and product_id=product.id and status<>'cancelled'
 ) then raise exception 'Оформление уже приобретено'; end if;
 update public.wallets set balance=balance-product.price where profile_id=auth.uid() and balance>=product.price;
 if not found then raise exception 'Недостаточно OfficeCoin'; end if;
 if product.cosmetic_code is null then
  update public.reward_products set stock=stock-1 where id=product.id;
 end if;
 insert into public.reward_orders(id,profile_id,product_id,price,status)
 values(p_request_id,auth.uid(),product.id,product.price,case when product.cosmetic_code is null then 'ordered' else 'issued' end);
 insert into public.wallet_transactions(profile_id,operation_key,amount) values(auth.uid(),'shop:'||p_request_id,-product.price);
 if product.cosmetic_code is not null then
  update public.profiles set accent_code=product.cosmetic_code where id=auth.uid();
 end if;
 return p_request_id;
end $$;

create function public.equip_cosmetic(p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_code not in ('standard','gold','ice') or p_code is null then raise exception 'Неизвестное оформление'; end if;
 if p_code <> 'standard' and not exists (
   select 1 from public.reward_orders o
   join public.reward_products p on p.id=o.product_id
   where o.profile_id=auth.uid() and o.status='issued' and p.cosmetic_code=p_code
 ) then raise exception 'Оформление не приобретено'; end if;
 update public.profiles set accent_code=p_code where id=auth.uid();
end $$;
revoke all on function public.equip_cosmetic(text) from public;
grant execute on function public.equip_cosmetic(text) to authenticated;

notify pgrst,'reload schema';
commit;
