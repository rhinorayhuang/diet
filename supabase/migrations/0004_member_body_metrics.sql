-- v1.2：成員的實測 BMR 與體脂率（PRD 3.2、3.4），用於更準確的熱量與蛋白質目標
alter table members
  add column measured_bmr integer check (measured_bmr between 500 and 5000),
  add column body_fat_pct numeric(4, 1) check (body_fat_pct > 0 and body_fat_pct < 70);
