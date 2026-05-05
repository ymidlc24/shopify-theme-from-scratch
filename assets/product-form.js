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

  const activeAddons = Array.from(section.querySelectorAll('.addon-checkbox:checked'));
  const addonTotalCents = activeAddons.reduce((sum, el) => sum + parseInt(el.dataset.addonPrice || 0), 0);

  if (matchedVariant) {
    const cartItem = cartJson.items.find(item => item.variant_id === matchedVariant.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    const isTracked = matchedVariant.inventory_management && matchedVariant.inventory_policy !== 'continue';
    const maxStock = isTracked ? matchedVariant.inventory_quantity : 999;

    buyButton.dataset.variantId = matchedVariant.id;

    if (window.event && window.event.target.classList.contains('variant-select')) {
      quantityInput.value = cartQty > 0 ? cartQty : 1;
    }

    if (parseInt(quantityInput.value) > maxStock) quantityInput.value = maxStock;
    quantityInput.setAttribute('max', maxStock);

    const priceElement = document.getElementById(`product-price-${sectionId}`);
    if (priceElement) {
      priceElement.textContent = formatMoney(matchedVariant.price + addonTotalCents);
    }

    const stockBar = document.getElementById(`stock-bar-${sectionId}`);
    const stockStatus = document.getElementById(`inventory-status-${sectionId}`);
    if (stockBar && isTracked) {
      stockStatus.classList.remove('tw:hidden');
      const percent = Math.min((matchedVariant.inventory_quantity / 20) * 100, 100);
      stockBar.style.width = percent + '%';
      document.getElementById(`stock-count-${sectionId}`).textContent = `${matchedVariant.inventory_quantity} in stock`;
      document.getElementById(`stock-label-${sectionId}`).textContent = matchedVariant.inventory_quantity > 5 ? 'In Stock' : 'Low Stock';
    } else if (stockStatus) {
      stockStatus.classList.add('tw:hidden');
    }

    const currentVal = parseInt(quantityInput.value) || 0;
    buyButton.disabled = !matchedVariant.available;
    buyButton.textContent = matchedVariant.available ? (cartQty > 0 ? (currentVal === 0 ? 'Remove' : 'Update Cart') : 'Add to Cart') : 'Out of Stock';
  }
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'product-form') return;
  e.preventDefault();

  const section = e.target.closest('[data-section]');
  const sectionId = section.dataset.section;
  const addonMap = JSON.parse(document.getElementById(`AddonMap-${sectionId}`).textContent);

  const btn = e.target.querySelector('[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const mainId = btn.dataset.variantId;
  const qty = parseInt(e.target.querySelector('input[type="number"]').value);
  const activeCheckboxes = Array.from(e.target.querySelectorAll('.addon-checkbox:checked'));

  let items = [{
    id: parseInt(mainId),
    quantity: qty,
    properties: { 'Add-ons': activeCheckboxes.map(cb => cb.dataset.addonName).join(', ') || 'None' }
  }];

  activeCheckboxes.forEach(cb => {
    const name = cb.dataset.addonName;
    if (addonMap[name]) {
      items.push({ 
        id: parseInt(addonMap[name]), 
        quantity: qty, 
        properties: { '_hidden': true, 'Parent': mainId } 
      });
    }
  });

  try {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items })
    });

    if (response.ok) {
      window.location.href = '/cart';
    } else {
      throw new Error();
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = originalText; }, 2000);
  }
});

['change', 'input'].forEach(evt => {
  document.addEventListener(evt, (e) => {
    const section = e.target.closest('[data-section]');
    if (section && (e.target.classList.contains('variant-select') || e.target.classList.contains('addon-checkbox') || e.target.type === 'number')) {
      updateProductUI(section);
    }
  });
});