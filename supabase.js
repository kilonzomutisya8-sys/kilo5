/* =========================================================
   Kilo Auto Spares Ltd — Supabase Connection
   ---------------------------------------------------------
   This file holds your Supabase project details and a small
   set of helper functions every other file uses to talk to
   your database. You should NOT need to edit anything below
   the config block unless Anthropic/Supabase support tells
   you to.

   IMPORTANT: the key below is a "publishable" (anon) key,
   which is SAFE to expose in front-end code like this — it's
   the same key type Supabase expects you to ship in a public
   website. It can only do what your table's Row Level
   Security (RLS) policies allow it to do. See SUPABASE_SETUP.md
   for the exact policies this site expects.
   ========================================================= */

const SUPABASE_URL = 'https://rzhftdmumvfjspijynfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JlwCsJ-u6Ge47XRQEfhB4A_Sddc_Tb6';

const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`;
const SUPABASE_STORAGE = `${SUPABASE_URL}/storage/v1`;
const PRODUCT_IMAGE_BUCKET = 'product-images';

function sbHeaders(extra) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra
  };
}

async function sbRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_REST}${path}`, {
    ...options,
    headers: sbHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* ignore */ }
    throw new Error(`Supabase request failed (${res.status}) ${detail}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ---------- Products table ---------- */

// Convert a database row (snake_case) into the shape the rest
// of the site already expects (camelCase, matches old JSON file).
function dbRowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    category: row.category,
    subcategory: row.subcategory || '',
    price: Number(row.price),
    originalPrice: row.original_price !== null && row.original_price !== undefined ? Number(row.original_price) : null,
    image: row.image || '',
    description: row.description || ''
  };
}

// Convert a product object (camelCase) into a database row for
// inserting/updating.
function productToDbRow(p) {
  return {
    name: p.name,
    brand: p.brand || null,
    category: p.category,
    subcategory: p.subcategory || null,
    price: p.price,
    original_price: (p.originalPrice === undefined || p.originalPrice === null || p.originalPrice === '') ? null : Number(p.originalPrice),
    image: p.image || null,
    description: p.description || null
  };
}

async function sbGetProducts() {
  const rows = await sbRequest('/products?select=*&order=id.asc');
  return rows.map(dbRowToProduct);
}

async function sbInsertProduct(product) {
  const rows = await sbRequest('/products', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(productToDbRow(product))
  });
  return dbRowToProduct(rows[0]);
}

// Bulk insert — used by the Admin "Upload XLSX/CSV" flow.
async function sbInsertProducts(products) {
  const rows = await sbRequest('/products', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(products.map(productToDbRow))
  });
  return rows.map(dbRowToProduct);
}

async function sbUpdateProduct(id, product) {
  const rows = await sbRequest(`/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(productToDbRow(product))
  });
  return dbRowToProduct(rows[0]);
}

async function sbDeleteProduct(id) {
  await sbRequest(`/products?id=eq.${id}`, { method: 'DELETE' });
}

/* ---------- Site settings (e.g. show/hide prices) ---------- */

// Single row (id = 1) holding site-wide toggles. If the row or
// table doesn't exist yet (before SUPABASE_SETUP.md's site_settings
// step has been run), this safely defaults to "show prices" so the
// site behaves exactly as before until the admin sets it up.
async function sbGetShowPrices() {
  try {
    const rows = await sbRequest('/site_settings?select=show_prices&id=eq.1');
    if (rows && rows.length > 0 && rows[0].show_prices !== null && rows[0].show_prices !== undefined) {
      return rows[0].show_prices !== false;
    }
    return true;
  } catch (e) {
    console.warn('Could not load the show-prices setting — defaulting to showing prices.', e);
    return true;
  }
}

async function sbSetShowPrices(value) {
  await sbRequest('/site_settings?id=eq.1', {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ show_prices: !!value })
  });
}

/* ---------- Storage (product photo uploads) ---------- */

// Uploads a File object the admin picked from their computer and
// returns a public URL you can save straight into a product's
// "image" field.
async function sbUploadImage(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${safeName}`;
  const res = await fetch(`${SUPABASE_STORAGE}/object/${PRODUCT_IMAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': file.type || 'application/octet-stream' }),
    body: file
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* ignore */ }
    throw new Error(`Image upload failed (${res.status}) ${detail}`);
  }
  return `${SUPABASE_STORAGE}/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`;
}
