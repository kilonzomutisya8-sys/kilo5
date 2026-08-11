# Connecting Kilo Auto Spares Ltd to Supabase

Your site's code is already pointed at your Supabase project
(`supabase.js`) using the key you shared. You still need to
create the **database table** and (optionally) the **image
storage bucket** in your Supabase dashboard — a few minutes of
one-time setup.

## 1. Create the `products` table

1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Paste the SQL below and click **Run**.

```sql
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  brand text,
  category text not null,
  subcategory text,
  price numeric not null,
  original_price numeric,
  image text,
  description text,
  created_at timestamptz default now()
);

alter table products enable row level security;

-- Anyone (including visitors browsing your site) can read products.
create policy "Public can read products"
  on products for select
  using (true);

-- Anyone with your publishable key can add/edit/delete products.
-- This matches the simple password-gated Admin page — it is NOT
-- strong security. Don't store anything on this site you wouldn't
-- want a determined visitor to be able to edit. If that ever
-- matters more, ask about switching this policy to require
-- Supabase Auth (real staff logins) instead.
create policy "Public can write products"
  on products for all
  using (true)
  with check (true);
```

3. (Optional but recommended) Load your current catalogue in one
   go instead of re-typing everything in Admin. Run this once,
   right after the table above:

```sql
insert into products (name, brand, category, subcategory, price, original_price, image, description) values
('Front Shock Absorber','Sachs','Suspension Parts','Shock Absorbers',13500,14500,'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&q=80','Genuine-spec front shock absorber for German saloons. Sold individually.'),
('Rear Shock Absorber Set','KYB','Suspension Parts','Shock Absorbers',8500,null,'https://images.unsplash.com/photo-1552930219-29d889622d2e?w=600&q=80','Matched pair for Japanese saloons and light SUVs, direct fit.'),
('Front Control Arm Assembly','Moog','Suspension Parts','Control Arms',11000,12000,'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80','Complete assembly with bushings and ball joint, ready to bolt on.'),
('Stabilizer Link Kit','Febi','Suspension Parts','Stabilizer Links',3200,null,'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600&q=80','Heavy-duty front stabilizer links, sold as a pair.'),
('Front Wheel Bearing Kit','SKF','Suspension Parts','Wheel Bearings',5200,5800,'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80','Sealed wheel bearing kit with hub, direct fit for most Japanese saloons.'),
('Rubber Arm Bush (Pair)','Febest','Suspension Parts','Rubber Arm Bushes',1800,null,'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600&q=80','Front lower arm bushings, sold as a matched pair.'),
('Ventilated Brake Discs (Pair)','Brembo','Suspension Parts','Brake Discs',16500,18000,'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600&q=80','Performance ventilated discs for improved cooling under braking.'),
('Ceramic Brake Pads (Front)','Bosch','Service Parts','Brake Pads',6000,6500,'https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&q=80','Low-dust ceramic compound, quiet and long-lasting.'),
('Engine Oil Filter','Mann','Service Parts','Oil Filter',1500,null,'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&q=80','OEM-spec spin-on oil filter.'),
('Cabin & Air Filter Combo','Bosch','Service Parts','Air Filters',3200,3500,'https://images.unsplash.com/photo-1552930219-29d889622d2e?w=600&q=80','High-flow engine air filter with matching cabin filter.'),
('Iridium Spark Plugs (Set of 4)','NGK','Service Parts','Spark Plugs',5500,6000,'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600&q=80','Long-life iridium tips for smoother idle and better fuel economy.'),
('Synthetic Engine Oil 5W-30 (4L)','Total','Service Parts','Engine Oil',7200,7800,'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600&q=80','Fully synthetic 5W-30, ILSAC GF-6A rated. 4 litre container.'),
('Ignition Coil Pack','Delphi','Service Parts','Ignition Coils',5000,5500,'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600&q=80','Heavy-duty coil pack, direct OEM replacement.'),
('Oxygen (O2) Lambda Sensor','Denso','Engine Parts','Sensors',9500,null,'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80','Direct-fit lambda sensor for accurate fuel mixture control.'),
('Water Pump Assembly','Aisin','Engine Parts','Water Pumps',8800,9500,'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&q=80','Complete water pump assembly, gasket included.'),
('Timing Belt Tensioner Roller','Febi','German Parts',null,6200,6999,'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600&q=80','OEM-spec tensioning roller for German engines.'),
('Front Suspension Strut','Sachs','German Parts',null,15600,17000,'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&q=80','Complete front strut assembly for German saloons and SUVs.'),
('Toyota Full Service Kit','Assorted','Service Kits','Japanese Cars',9000,10000,'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600&q=80','Complete service kit: oil filter, air filter, fuel filter and engine oil bundled together.'),
('Maintenance-Free Battery (65Ah)','Bosch','Car Batteries',null,13000,13500,'https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&q=80','Sealed DIN battery, no top-up required.'),
('NS60 Chloride Exide Battery','Chloride Exide','Car Batteries',null,8000,8500,'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600&q=80','Reliable starter battery for popular Japanese saloons.'),
('195/65R15 Car Tyre','Petromax','Tyres',null,7000,7800,'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=600&q=80','Reliable all-round tyre size 195/65R15, price inclusive of professional fitment.');
```

## 2. Create the image storage bucket (for Admin photo uploads)

Only needed if you plan to upload photos from your computer in
Admin (as opposed to always pasting an image link). In the SQL
Editor, run:

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Public can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');
```

## 3. Upload the site files

Upload every file in this folder to your GitHub repo root (same
flat structure as before — no subfolders):

- `index.html`, `shop.html`, `about.html`, `contact.html`, `admin.html`
- `style.css`
- `supabase.js` ← new
- `products.js` ← updated
- `layout.js` ← updated
- `cart.js` ← updated
- `admin.js` ← new

You no longer need `products-data.json` — the site reads live
from Supabase now. You can delete it from the repo, or leave it,
it's simply unused.

## 4. Try it

1. Open your live site — Home and Shop should show the products
   you just inserted in step 1.
2. Open `admin.html`, log in with the password `kiloadmin2026`
   (change this at the top of `admin.js` — search for
   `ADMIN_PASSWORD`).
3. Add a product manually, or use **Upload XLSX / CSV** with a
   file containing columns: `Name`, `Price`, and optionally
   `Category`, `Subcategory`, `Brand`, `OriginalPrice`,
   `Description`, `Image` (a photo link).
4. Refresh Home/Shop in another tab — the change should already
   be there.

## A note on security

The key in `supabase.js` is a "publishable" key — safe to ship in
a public site, but it can only do what the RLS policies above
allow. As written, those policies let **anyone who has the key**
(which is visible in your site's source code, like all front-end
code) add, edit, or delete products directly, bypassing the
Admin password entirely if they wanted to poke at the API by
hand. For a small shop catalogue this is a reasonable trade-off —
it's no less secure than the original plan of anyone finding your
GitHub repo — but if you'd like real protection later (e.g. only
logged-in staff can write), say the word and this can be upgraded
to use Supabase Auth with a proper login instead of the shared
password.
