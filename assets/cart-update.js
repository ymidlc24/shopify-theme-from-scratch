document.addEventListener('DOMContentLoaded', function() {
  const cartForm = document.querySelector('#cart-form');
  const headerCartCount = document.querySelector('.cart-count');
  if (!cartForm) return;

  let isUpdating = false;

  async function updateCart(line, quantity, input) {
    if (isUpdating) return;
    const maxAllowed = parseInt(input.getAttribute('max')) || 999;
    let finalQty = quantity;
    if (quantity > maxAllowed) { finalQty = maxAllowed; input.value = maxAllowed; }

    isUpdating = true;
    const cartContainer = document.querySelector('#main-cart');
    if (cartContainer) cartContainer.style.opacity = '0.5';

    try {
      const cartRes = await fetch('/cart.js');
      const cartData = await cartRes.json();
      const targetItem = cartData.items[line - 1];
      let updates = { [targetItem.key]: finalQty };

      // Sync hidden add-ons with main product quantity
      cartData.items.forEach(item => {
        if (item.properties && item.properties._hidden && item.properties.Parent == targetItem.variant_id) {
          updates[item.key] = finalQty;
        }
      });

      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updates, sections: 'main-cart' })
      });

      const data = await response.json();
      if (data.sections && data.sections['main-cart']) {
        const parser = new DOMParser();
        const html = parser.parseFromString(data.sections['main-cart'], 'text/html');
        document.querySelector('#main-cart').innerHTML = html.querySelector('#main-cart').innerHTML;
      }
      if (headerCartCount) headerCartCount.textContent = data.item_count;

    } catch (error) {
      window.location.reload();
    } finally {
      isUpdating = false;
      if (cartContainer) cartContainer.style.opacity = '1';
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || isUpdating) return;
    const row = btn.closest('tr[data-line]');
    if (!row) return;
    const input = row.querySelector('input[name="updates[]"]');
    const line = row.dataset.line;
    let currentQty = parseInt(input.value);

    if (btn.classList.contains('plus')) updateCart(line, currentQty + 1, input);
    if (btn.classList.contains('minus')) updateCart(line, Math.max(0, currentQty - 1), input);
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'updates[]') {
      const row = e.target.closest('tr[data-line]');
      if (row) updateCart(row.dataset.line, parseInt(e.target.value) || 0, e.target);
    }
  });
});