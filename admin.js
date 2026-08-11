/* =========================================================
   Kilo Auto Spares Ltd — Admin Panel Logic
   ---------------------------------------------------------
   Everything here reads/writes your Supabase "products" table
   directly (see supabase.js). There is no local draft anymore —
   every save is live on the site immediately.
   ========================================================= */

// CHANGE THIS before you rely on this page — it's the password
// that gates the whole Admin panel. It lives in this file, so
// anyone who views the page source can find it; that's fine for
// keeping casual visitors out, but don't treat it as strong
// security. Ask your developer about Supabase Auth if you need
// real staff accounts later.
const ADMIN_PASSWORD = 'kiloadmin2026';
const ADMIN_SESSION_KEY = 'kilo_admin_session';

let allProducts = [];
let selectedImageFile = null;
let bulkPhotoFile = null;
let bulkPhotoSelectedIds = new Set();

/* ---------- Login ---------- */

function attemptLogin() {
  const input = document.getElementById('adminPassword');
  const error = document.getElementById('loginError');
  if (input.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    showDashboard();
  } else {
    error.classList.remove('hidden');
  }
}
window.attemptLogin = attemptLogin;

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  initAdmin();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
});

if (sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') {
  showDashboard();
}

/* ---------- Setup ---------- */

let adminInitialized = false;

async function initAdmin() {
  populateCategorySelects();
  document.getElementById('adminSearch').addEventListener('input', renderTable);
  document.getElementById('adminCategoryFilter').addEventListener('change', renderTable);
  document.getElementById('pCategory').addEventListener('change', updateSubcategoryOptions);
  document.getElementById('pImageFile').addEventListener('change', handleImageFileChange);
  document.getElementById('pImageUrl').addEventListener('input', handleImageUrlChange);
  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);
  document.getElementById('pBulkExcelInput').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) processBulkFile(file);
  });
  setupDropZone(document.getElementById('pImageDropZone'), files => {
    const file = [...files].find(f => f.type.startsWith('image/'));
    if (file) applyImageFile(file);
  });
  setupDropZone(document.getElementById('pBulkDropZone'), files => {
    const file = [...files][0];
    if (file) processBulkFile(file);
  });
  document.getElementById('productModal').addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { applyImageFile(file); e.preventDefault(); }
        return;
      }
    }
  });

  document.getElementById('bpCategory').addEventListener('change', updateBulkPhotoSubcategoryOptions);
  document.getElementById('bpSubcategory').addEventListener('change', renderBulkPhotoProductList);
  document.getElementById('bpSearch').addEventListener('input', renderBulkPhotoProductList);
  document.getElementById('bpProductList').addEventListener('change', e => {
    const checkbox = e.target.closest('input[type="checkbox"][data-product-id]');
    if (!checkbox) return;
    const id = Number(checkbox.dataset.productId);
    if (checkbox.checked) bulkPhotoSelectedIds.add(id);
    else bulkPhotoSelectedIds.delete(id);
    updateBulkPhotoMatchCount();
  });
  document.getElementById('bpImageFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) applyBulkImageFile(file);
  });
  document.getElementById('bpImageUrl').addEventListener('input', e => {
    if (bulkPhotoFile) return; // a picked file takes priority in the preview
    const url = e.target.value.trim();
    if (url) {
      document.getElementById('bpImagePreview').src = url;
      document.getElementById('bpImagePreview').classList.remove('hidden');
    }
  });
  setupDropZone(document.getElementById('bpImageDropZone'), files => {
    const file = [...files].find(f => f.type.startsWith('image/'));
    if (file) applyBulkImageFile(file);
  });
  document.getElementById('bulkPhotoModal').addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { applyBulkImageFile(file); e.preventDefault(); }
        return;
      }
    }
  });

  if (!adminInitialized) {
    adminInitialized = true;
  }
  await refreshProducts();
  await initPricesToggle();
}

/* ---------- Show/Hide Prices toggle ---------- */
// Controls a single site_settings row that every visitor-facing page
// reads (via loadProducts() in products.js). This admin table always
// shows real prices no matter what this is set to — the toggle only
// hides prices from visitors on Home/Shop/Quick View/Cart/WhatsApp.

let currentShowPrices = true;

async function initPricesToggle() {
  const btn = document.getElementById('pricesToggleBtn');
  try {
    currentShowPrices = await sbGetShowPrices();
  } catch (e) {
    currentShowPrices = true;
  }
  renderPricesToggle();
  btn.disabled = false;
}

function renderPricesToggle() {
  const btn = document.getElementById('pricesToggleBtn');
  const icon = document.getElementById('pricesToggleIcon');
  const label = document.getElementById('pricesToggleLabel');
  if (currentShowPrices) {
    btn.classList.remove('bg-red-600/20', 'border-red-500/40', 'text-red-300');
    btn.classList.add('bg-emerald-600/20', 'border-emerald-500/40', 'text-emerald-300');
    icon.className = 'fa-solid fa-eye';
    label.textContent = 'Prices: Visible to Visitors';
  } else {
    btn.classList.remove('bg-emerald-600/20', 'border-emerald-500/40', 'text-emerald-300');
    btn.classList.add('bg-red-600/20', 'border-red-500/40', 'text-red-300');
    icon.className = 'fa-solid fa-eye-slash';
    label.textContent = 'Prices: Hidden From Visitors';
  }
}

async function togglePricesVisibility() {
  const btn = document.getElementById('pricesToggleBtn');
  const next = !currentShowPrices;
  btn.disabled = true;
  try {
    await sbSetShowPrices(next);
    currentShowPrices = next;
    renderPricesToggle();
    invalidateProductsCache();
  } catch (e) {
    alert('Could not update the prices setting. If this is the first time you\'re using this, make sure the site_settings table has been created — see SUPABASE_SETUP.md.\n\n' + e.message);
  } finally {
    btn.disabled = false;
  }
}
window.togglePricesVisibility = togglePricesVisibility;

function populateCategorySelects() {
  const filterSelect = document.getElementById('adminCategoryFilter');
  const formSelect = document.getElementById('pCategory');
  CATEGORIES.forEach(cat => {
    filterSelect.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
    formSelect.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
  });
  updateSubcategoryOptions();
}

function updateSubcategoryOptions() {
  const cat = document.getElementById('pCategory').value;
  const list = document.getElementById('pSubcategoryOptions');
  const subs = CATEGORY_STRUCTURE[cat] || [];
  list.innerHTML = subs.map(s => `<option value="${s}"></option>`).join('');
}

/* ---------- Loading & rendering the table ---------- */

async function refreshProducts() {
  invalidateProductsCache();
  try {
    allProducts = await loadProducts();
  } catch (e) {
    alert('Could not load products from Supabase. Check your connection and supabase.js config.\n\n' + e.message);
    allProducts = [];
  }
  renderTable();
}
window.refreshProducts = refreshProducts;

function renderTable() {
  const tbody = document.getElementById('adminProductTable');
  const search = document.getElementById('adminSearch').value.toLowerCase();
  const catFilter = document.getElementById('adminCategoryFilter').value;

  const filtered = allProducts.filter(p => {
    const matchesCat = catFilter === 'all' || p.category === catFilter;
    const haystack = `${p.name} ${p.brand || ''}`.toLowerCase();
    return matchesCat && haystack.includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-slate-500">No products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr class="hover:bg-slate-900/50">
      <td class="px-4 py-3"><img src="${p.image || ''}" alt="${p.name}" class="w-12 h-12 rounded object-cover bg-slate-900 border border-slate-800" onerror="this.style.opacity=0.2"></td>
      <td class="px-4 py-3 text-white font-medium">${p.name}<div class="text-xs text-slate-500">${p.category}${p.subcategory ? ' &middot; ' + p.subcategory : ''}</div></td>
      <td class="px-4 py-3 text-slate-400">${p.brand || '—'}</td>
      <td class="px-4 py-3 text-slate-400">${p.category}</td>
      <td class="px-4 py-3 text-slate-200 font-semibold">${p.price.toLocaleString()}${p.originalPrice ? `<span class="text-slate-600 line-through ml-2 text-xs">${p.originalPrice.toLocaleString()}</span>` : ''}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick="openProductModal(${p.id})" class="text-slate-400 hover:text-white px-2" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteProductClick(${p.id})" class="text-slate-400 hover:text-red-400 px-2" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

/* ---------- Add / Edit modal ---------- */

function openProductModal(id) {
  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');
  form.reset();
  selectedImageFile = null;
  document.getElementById('pImagePreview').classList.add('hidden');

  if (id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('pId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pBrand').value = p.brand || '';
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pOriginalPrice').value = p.originalPrice || '';
    document.getElementById('pCategory').value = p.category;
    updateSubcategoryOptions();
    document.getElementById('pSubcategory').value = p.subcategory || '';
    document.getElementById('pDescription').value = p.description || '';
    document.getElementById('pImageUrl').value = p.image || '';
    if (p.image) {
      document.getElementById('pImagePreview').src = p.image;
      document.getElementById('pImagePreview').classList.remove('hidden');
    }
  } else {
    document.getElementById('modalTitle').textContent = 'Add Product';
    document.getElementById('pId').value = '';
    updateSubcategoryOptions();
  }

  modal.classList.remove('hidden');
}
window.openProductModal = openProductModal;

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
}
window.closeProductModal = closeProductModal;

function setupDropZone(el, onFiles) {
  if (!el) return;
  ['dragenter', 'dragover'].forEach(evt => el.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('ring-2', 'ring-emerald-500');
  }));
  ['dragleave', 'drop'].forEach(evt => el.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('ring-2', 'ring-emerald-500');
  }));
  el.addEventListener('drop', e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) onFiles(files);
  });
}

function applyImageFile(file) {
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('pImagePreview').src = ev.target.result;
    document.getElementById('pImagePreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function handleImageFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  applyImageFile(file);
}

function handleImageUrlChange(e) {
  if (selectedImageFile) return; // a picked file takes priority in the preview
  const url = e.target.value.trim();
  if (url) {
    document.getElementById('pImagePreview').src = url;
    document.getElementById('pImagePreview').classList.remove('hidden');
  }
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const id = document.getElementById('pId').value;
    let imageUrl = document.getElementById('pImageUrl').value.trim();

    if (selectedImageFile) {
      imageUrl = await sbUploadImage(selectedImageFile);
    }

    const existing = id ? allProducts.find(p => p.id === Number(id)) : null;

    const originalPriceRaw = document.getElementById('pOriginalPrice').value.trim();

    const product = {
      name: document.getElementById('pName').value.trim(),
      brand: document.getElementById('pBrand').value.trim(),
      price: Number(document.getElementById('pPrice').value),
      originalPrice: originalPriceRaw === '' ? null : Number(originalPriceRaw),
      category: document.getElementById('pCategory').value,
      subcategory: document.getElementById('pSubcategory').value.trim(),
      description: document.getElementById('pDescription').value.trim(),
      image: imageUrl || (existing ? existing.image : '')
    };

    if (id) {
      await sbUpdateProduct(Number(id), product);
    } else {
      // Same name-matching as bulk upload — if a product with this
      // exact name already exists anywhere on the site, update it
      // instead of creating a duplicate.
      const duplicate = allProducts.find(p => p.name.trim().toLowerCase() === product.name.toLowerCase());
      if (duplicate) {
        const useExistingImage = !imageUrl && duplicate.image;
        await sbUpdateProduct(duplicate.id, { ...product, image: useExistingImage ? duplicate.image : product.image });
        closeProductModal();
        await refreshProducts();
        alert(`"${product.name}" already existed — updated it instead of creating a duplicate.`);
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        return;
      }
      await sbInsertProduct(product);
    }

    closeProductModal();
    await refreshProducts();
  } catch (err) {
    alert('Could not save this product.\n\n' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

async function deleteProductClick(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This removes it from the live site immediately and can't be undone.`)) return;
  try {
    await sbDeleteProduct(id);
    await refreshProducts();
  } catch (err) {
    alert('Could not delete this product.\n\n' + err.message);
  }
}
window.deleteProductClick = deleteProductClick;

/* ---------- Bulk apply one photo to a whole subcategory ---------- */
/*
   Lets you upload (or paste/link) a single photo and stamp it onto
   every product currently in a chosen subcategory — e.g. you don't
   have individual photos for each "Coil Springs" listing yet, so you
   apply one generic coil-spring photo to all of them at once.

   You can always come back later, open a specific product with the
   pencil icon in the table, and upload/paste a photo just for that
   one — a normal single-product edit always overrides whatever the
   bulk tool set, and re-running the bulk tool with a new photo
   simply overwrites again (there's nothing separate to "delete" —
   uploading a new photo, either in bulk or on one product, replaces
   the old one).
*/

function openBulkPhotoModal() {
  bulkPhotoFile = null;
  bulkPhotoSelectedIds = new Set();
  document.getElementById('bpImagePreview').classList.add('hidden');
  document.getElementById('bpImagePreview').src = '';
  document.getElementById('bpImageUrl').value = '';
  document.getElementById('bpImageFile').value = '';
  document.getElementById('bpSearch').value = '';
  populateBulkPhotoCategorySelect();
  updateBulkPhotoSubcategoryOptions();
  document.getElementById('bulkPhotoModal').classList.remove('hidden');
}
window.openBulkPhotoModal = openBulkPhotoModal;

function closeBulkPhotoModal() {
  document.getElementById('bulkPhotoModal').classList.add('hidden');
}
window.closeBulkPhotoModal = closeBulkPhotoModal;

function populateBulkPhotoCategorySelect() {
  const select = document.getElementById('bpCategory');
  if (select.dataset.populated) return;
  CATEGORIES.forEach(cat => {
    select.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
  });
  select.dataset.populated = '1';
}

// The subcategory dropdown is built from the subcategory values that
// actually exist on your live products right now (not just the master
// CATEGORY_STRUCTURE list) — so it always lines up exactly with what's
// in the database, even if a product's subcategory text is a little
// off from the canonical spelling. This is just a FILTER now — it
// narrows which products show up below, it doesn't apply the photo
// to a whole subcategory by itself. You still tick the exact products
// you want (5, 10, 20, or any number) in the checklist underneath.
function updateBulkPhotoSubcategoryOptions() {
  const cat = document.getElementById('bpCategory').value;
  const select = document.getElementById('bpSubcategory');

  const subsSet = new Set();
  allProducts.forEach(p => {
    if (!p.subcategory) return;
    if (cat !== 'all' && p.category !== cat) return;
    subsSet.add(p.subcategory);
  });
  const subs = [...subsSet].sort();

  select.innerHTML = '<option value="all">All Subcategories</option>' +
    subs.map(s => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');
  renderBulkPhotoProductList();
}

// Products currently visible in the checklist based on the
// Category / Subcategory / Search filters — NOT the same as which
// products are selected to receive the photo.
function bulkPhotoFilteredProducts() {
  const cat = document.getElementById('bpCategory').value;
  const sub = document.getElementById('bpSubcategory').value;
  const q = document.getElementById('bpSearch').value.trim().toLowerCase();

  return allProducts.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (sub !== 'all' && p.subcategory !== sub) return false;
    if (q) {
      const haystack = `${p.name} ${p.brand || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// Renders the checklist of filtered products. Selection state
// (bulkPhotoSelectedIds) persists across re-filtering, so you can
// narrow the list, tick a few, narrow again, and tick more — the
// earlier ticks stay checked even once they scroll out of view.
function renderBulkPhotoProductList() {
  const listEl = document.getElementById('bpProductList');
  const filtered = bulkPhotoFilteredProducts();

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-500 p-4 text-center">No products match these filters.</p>`;
  } else {
    listEl.innerHTML = filtered.map(p => `
      <label class="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/60 cursor-pointer">
        <input type="checkbox" data-product-id="${p.id}" ${bulkPhotoSelectedIds.has(p.id) ? 'checked' : ''} class="w-4 h-4 accent-emerald-600 shrink-0">
        <img src="${p.image}" alt="" class="w-9 h-9 rounded object-cover bg-slate-800 border border-slate-700 shrink-0">
        <span class="flex-1 min-w-0">
          <span class="block text-xs text-white truncate">${p.brand ? p.brand + ' — ' : ''}${p.name}</span>
          <span class="block text-[11px] text-slate-500 truncate">${p.subcategory || p.category}</span>
        </span>
      </label>
    `).join('');
  }

  updateBulkPhotoMatchCount();
}

function bulkPhotoSelectAllVisible() {
  bulkPhotoFilteredProducts().forEach(p => bulkPhotoSelectedIds.add(p.id));
  renderBulkPhotoProductList();
}
window.bulkPhotoSelectAllVisible = bulkPhotoSelectAllVisible;

function bulkPhotoClearSelection() {
  bulkPhotoSelectedIds.clear();
  renderBulkPhotoProductList();
}
window.bulkPhotoClearSelection = bulkPhotoClearSelection;

function bulkPhotoMatches() {
  return allProducts.filter(p => bulkPhotoSelectedIds.has(p.id));
}

function updateBulkPhotoMatchCount() {
  const countEl = document.getElementById('bpMatchCount');
  const count = bulkPhotoSelectedIds.size;
  countEl.textContent = count > 0
    ? `This will set the photo on the ${count} product${count === 1 ? '' : 's'} you've selected.`
    : 'Tick the products above that should get this photo.';
}

function applyBulkImageFile(file) {
  bulkPhotoFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('bpImagePreview').src = ev.target.result;
    document.getElementById('bpImagePreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function applyBulkPhoto() {
  const urlInput = document.getElementById('bpImageUrl').value.trim();
  if (!bulkPhotoFile && !urlInput) { alert('Add a photo — upload a file, drag one in, paste it, or paste an image URL.'); return; }

  const matches = bulkPhotoMatches();
  if (matches.length === 0) { alert('Tick at least one product in the list first.'); return; }

  if (!confirm(`Set this photo on the ${matches.length} selected product${matches.length === 1 ? '' : 's'}? This replaces their current photos.`)) return;

  const btn = document.getElementById('bpApplyBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    // Upload once, reuse the same resulting URL for every matching product.
    let imageUrl = urlInput;
    if (bulkPhotoFile) {
      imageUrl = await sbUploadImage(bulkPhotoFile);
    }

    await Promise.all(matches.map(p => sbUpdateProduct(p.id, { ...p, image: imageUrl })));

    await refreshProducts();
    closeBulkPhotoModal();
    alert(`Done — updated the photo on ${matches.length} selected product${matches.length === 1 ? '' : 's'}.`);
  } catch (err) {
    alert('Could not apply this photo to the selected products.\n\n' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
window.applyBulkPhoto = applyBulkPhoto;

/* ---------- Export backup ---------- */

function exportProducts() {
  const blob = new Blob([JSON.stringify(allProducts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportProducts = exportProducts;

/* ---------- Bulk upload (XLSX / CSV) ---------- */

async function processBulkFile(file) {
  try {
    const defaultCategory = document.getElementById('pCategory').value;
    const defaultSubcategory = document.getElementById('pSubcategory').value.trim();

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      alert('That file has no rows to import.');
      return;
    }

    // Best-effort: pull any pictures embedded/pasted directly into
    // the workbook (xl/media/*) and hand them out, in order, to
    // rows that don't already have an Image column value.
    let embeddedImageUrls = [];
    try {
      embeddedImageUrls = await extractEmbeddedImages(file);
    } catch (imgErr) {
      console.warn('Could not extract embedded images from the file.', imgErr);
    }
    let embeddedIndex = 0;

    // Recognizing a Subcategory (e.g. "Coil Springs", or messy variants
    // like "coil-spring" / "Coil  Springs ") tells us the right Category
    // ("Suspension Parts") even if the file's Category column is missing,
    // blank, or worded differently — see resolveSubcategory() in products.js.
    const canonicalCategoryByLower = {};
    CATEGORIES.forEach(c => { canonicalCategoryByLower[c.toLowerCase()] = c; });

    const getField = (row, ...names) => {
      for (const key of Object.keys(row)) {
        const cleanKey = key.trim().toLowerCase();
        if (names.some(n => n.toLowerCase() === cleanKey)) {
          const v = row[key];
          return typeof v === 'string' ? v.trim() : v;
        }
      }
      return '';
    };

    const toImport = [];
    const skipped = [];

    rows.forEach((row, i) => {
      const name = getField(row, 'Name', 'Product', 'Product Name', 'Part', 'Part Name');
      const priceRaw = getField(row, 'Price', 'Selling Price');

      if (!name || priceRaw === '' || priceRaw === undefined) {
        skipped.push(`Row ${i + 2}: missing Name or Price`);
        return;
      }

      const rawCategory = getField(row, 'Category', 'Type', 'Section');
      const rawSubcategory = getField(row, 'Subcategory', 'Sub-category', 'Sub Category', 'SubCategory');

      let category = '';
      let subcategory = '';

      // 1. A recognized subcategory always wins — it uniquely identifies
      //    the category, so "Coil Springs" correctly lands under
      //    Suspension Parts even with no/blank Category column, and even
      //    if the file's Category column says something else entirely.
      const subMatch = rawSubcategory && resolveSubcategory(rawSubcategory);
      if (subMatch) {
        category = subMatch.category;
        subcategory = subMatch.subcategory;
      } else if (rawCategory && canonicalCategoryByLower[rawCategory.toLowerCase()]) {
        category = canonicalCategoryByLower[rawCategory.toLowerCase()];
        subcategory = rawSubcategory || '';
      } else if (rawCategory) {
        // Category cell has a value, but it's not one we recognize —
        // skip rather than silently mis-file it.
        skipped.push(`Row ${i + 2} ("${name}"): category "${rawCategory}" doesn't match any existing category`);
        return;
      } else {
        // Nothing usable in the row itself — fall back to whatever
        // was picked above the upload button.
        category = defaultCategory;
        subcategory = rawSubcategory || defaultSubcategory;
      }

      let image = getField(row, 'Image', 'Image URL', 'Photo', 'Picture');
      if (!image && embeddedIndex < embeddedImageUrls.length) {
        image = embeddedImageUrls[embeddedIndex];
        embeddedIndex += 1;
      }

      toImport.push({
        name,
        brand: getField(row, 'Brand', 'Make', 'Manufacturer'),
        price: Number(priceRaw),
        originalPrice: getField(row, 'OriginalPrice', 'Original Price') || null,
        category,
        subcategory,
        description: getField(row, 'Description', 'Details'),
        image
      });
    });

    if (toImport.length === 0) {
      alert('No rows could be imported. ' + (skipped[0] || ''));
      return;
    }

    // Match against products already on the site by name (case/space
    // insensitive) so re-uploading the same file — e.g. after filling
    // in Image links you didn't have the first time — updates the
    // existing product instead of creating a duplicate.
    const existingByName = new Map();
    allProducts.forEach(p => existingByName.set(p.name.trim().toLowerCase(), p));

    const toInsert = [];
    const toUpdate = [];
    toImport.forEach(product => {
      const existing = existingByName.get(product.name.trim().toLowerCase());
      if (existing) {
        toUpdate.push({ id: existing.id, product });
      } else {
        toInsert.push(product);
      }
    });

    if (toInsert.length > 0) await sbInsertProducts(toInsert);
    if (toUpdate.length > 0) await Promise.all(toUpdate.map(u => sbUpdateProduct(u.id, u.product)));

    await refreshProducts();
    closeProductModal();

    let msg = '';
    if (toInsert.length > 0) msg += `Added ${toInsert.length} new product${toInsert.length === 1 ? '' : 's'}.\n`;
    if (toUpdate.length > 0) msg += `Updated ${toUpdate.length} existing product${toUpdate.length === 1 ? '' : 's'} (matched by name) — no duplicates created.\n`;
    if (skipped.length > 0) {
      msg += `\n\nSkipped ${skipped.length} row(s):\n` + skipped.slice(0, 15).join('\n');
      if (skipped.length > 15) msg += `\n...and ${skipped.length - 15} more`;
    }
    alert(msg);
  } catch (err) {
    alert('Could not process that file.\n\n' + err.message);
  }
}

// Reads pictures pasted directly into a workbook's cells (stored
// inside xl/media/*) and uploads each one to Supabase Storage,
// returning their public URLs in the same order they appear in
// the file. This is a best-effort match — if you need a picture
// tied to an exact row, use the Image URL column instead.
async function extractEmbeddedImages(file) {
  if (typeof JSZip === 'undefined') return [];
  const zip = await JSZip.loadAsync(file);
  const mediaFiles = Object.keys(zip.files)
    .filter(name => /^xl\/media\//.test(name))
    .sort();

  const urls = [];
  for (const name of mediaFiles) {
    const blob = await zip.files[name].async('blob');
    const ext = name.split('.').pop();
    const asFile = new File([blob], name.split('/').pop(), { type: blob.type || `image/${ext}` });
    const url = await sbUploadImage(asFile);
    urls.push(url);
  }
  return urls;
}
