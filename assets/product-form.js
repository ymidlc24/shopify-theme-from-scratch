function formatMoney(cents) {
  return "₱" + new Intl.NumberFormat('en-PH', {minimumFractionDigits: 2}).format(cents / 100);
}

function updateProductUI(section) {
  const sectionId = section.dataset.section;
  const variantData = JSON.parse(document.getElementById(`VariantJson-${sectionId}`).textContent);
  const cartJson = JSON.parse(document.getElementById(`CartInventoryJson-${sectionId}`).textContent);
  
  const quantityInput = section.querySelector('input[type="number"]');
  const currentOptions = Array.from(section.querySelectorAll('.variant-select')).map(s => s.value);
  const matchedVariant = variantData.find(v => currentOptions.every((opt, i) => v.options[i] === opt));
  const buyButton = section.querySelector('[type="submit"]');

  if (matchedVariant) {
    const cartItem = cartJson.items.find(item => item.variant_id === matchedVariant.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    const isTracked = matchedVariant.inventory_management && matchedVariant.inventory_policy !== 'continue';
    const maxStock = isTracked ? matchedVariant.inventory_quantity : 999;

    quantityInput.setAttribute('name', `updates[${matchedVariant.id}]`);

    if (window.event && window.event.target.classList.contains('variant-select')) {
      quantityInput.value = cartQty > 0 ? cartQty : 1;
    }

    if (parseInt(quantityInput.value) > maxStock) quantityInput.value = maxStock;
    quantityInput.setAttribute('max', maxStock);

    const currentVal = parseInt(quantityInput.value) || 0;
    buyButton.disabled = !matchedVariant.available;
    buyButton.textContent = matchedVariant.available ? (cartQty > 0 ? (currentVal === 0 ? 'Remove' : 'Update Cart') : 'Add to Cart') : 'Out of Stock';
  }
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'product-form') return;
  e.preventDefault();

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const response = await fetch('/cart/update.js', {
      method: 'POST',
      body: new FormData(e.target)
    });

    if (response.ok) {
      window.location.href = '/cart';
    } else {
      btn.disabled = false;
      btn.textContent = 'Error';
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Error';
  }
});

['change', 'input'].forEach(evt => {
  document.addEventListener(evt, (e) => {
    const section = e.target.closest('[data-section]');
    if (section && (e.target.classList.contains('variant-select') || e.target.type === 'number')) updateProductUI(section);
  });
});