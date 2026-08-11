/* =========================================================
   Kilo Auto Spares Ltd — Cart Logic (shared across pages)
   Cart itself lives only in memory for the current page visit
   (kept simple and predictable — no stale prices across visits).
   ========================================================= */

let cart = [];

function initCart() {
  const cartBtn = document.getElementById('cartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const closeCartBtn = document.getElementById('closeCartBtn');

  cartBtn.addEventListener('click', openCart);
  closeCartBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  updateCartUI();
}

function openCart() { document.getElementById('cartDrawer').classList.remove('hidden'); }
function closeCart() { document.getElementById('cartDrawer').classList.add('hidden'); }

window.addToCart = async function(productId) {
  const products = await loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  updateCartUI();
  openCart();
};

window.removeFromCart = function(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCartUI();
};

function updateCartUI() {
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const cartCount = document.getElementById('cartCount');
  const cartSubtotal = document.getElementById('cartSubtotal');
  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = '';
  let totalCount = 0;
  let subtotal = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<p class="text-center text-slate-500 py-12">Your cart is empty.</p>`;
  } else {
    cart.forEach(item => {
      totalCount += item.quantity;
      subtotal += item.price * item.quantity;

      const cartItem = document.createElement('div');
      cartItem.className = 'flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-3 rounded-lg';
      cartItem.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="w-14 h-14 object-cover rounded border border-slate-800">
          <div class="flex-1">
              <h4 class="text-xs font-medium text-white line-clamp-1">${item.brand ? item.brand + ' — ' : ''}${item.name}</h4>
              <p class="text-xs text-red-500 font-bold mt-1">KES ${item.price.toLocaleString()} x ${item.quantity}</p>
          </div>
          <button onclick="removeFromCart(${item.id})" class="text-slate-500 hover:text-red-400 p-2"><i class="fa-solid fa-trash"></i></button>
      `;
      cartItemsContainer.appendChild(cartItem);
    });
  }

  cartCount.textContent = totalCount;
  cartSubtotal.textContent = `KES ${subtotal.toLocaleString()}`;
}

window.checkoutWhatsApp = function() {
  if (cart.length === 0) {
    alert("Please add items to your cart first.");
    return;
  }
  let message = "Hello, I would like to confirm availability and order the following parts from Kilo Auto Spares Ltd (Witu Rd, Brunei House):\n\n";
  let total = 0;
  cart.forEach(item => {
    message += `- ${item.brand ? item.brand + ' ' : ''}${item.name} x ${item.quantity} (KES ${(item.price * item.quantity).toLocaleString()})\n`;
    total += item.price * item.quantity;
  });
  message += `\n*Total Estimated: KES ${total.toLocaleString()}*`;

  const encodedUrl = waLink(message);
  window.open(encodedUrl, '_blank');
};
