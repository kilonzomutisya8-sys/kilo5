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

  if (!adminInitialized) {
    adminInitialized = true;
  }
  await refreshProducts();
}

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
