-- Только демонстрационный стенд
insert into public.departments(name) values
  ('Офисные операции'), ('Разработка'), ('Дизайн'), ('Аналитика'), ('Поддержка')
on conflict (name) do nothing;
