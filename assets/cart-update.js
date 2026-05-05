document.addEventListener('DOMContentLoaded', function() {
  const cartForm = document.querySelector('#cart-form');
  const headerCartCount = document.querySelector('.cart-count'); // Ensure your header has this class
  if (!cartForm) return;

  let isUpdating = false;

  async function updateCart(itemKey, quantity) {
    if (isUpdating) return;
    isUpdating = true;
    
    const container = document.querySelector('#main-cart');
    if (container) container.style.opacity = '0.5';

    try {
      const cartRes = await fetch(window.Shopify.routes.root + 'cart.js');
      const cartData = await cartRes.json();
      const targetItem = cartData.items.find(i => i.key === itemKey);
      
      let updates = { [itemKey]: quantity };
      const bundleId = targetItem?.properties?._bundleId;

      if (bundleId) {
        cartData.items.forEach(item => {
          if (item.properties?._parentBundle === bundleId) {
            updates[item.key] = quantity;
          }
        });
      }

      const response = await fetch(window.Shopify.routes.root + 'cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updates, sections: 'main-cart' })
      });

      const data = await response.json();
      
      // 1. Update the Main Cart HTML
      if (data.sections && data.sections['main-cart']) {
        const parser = new DOMParser();
        const html = parser.parseFromString(data.sections['main-cart'], 'text/html');
        document.querySelector('#main-cart').innerHTML = html.querySelector('#main-cart').innerHTML;
      }

      // 2. Update Header Count (Filtered to show only visible items)
      if (headerCartCount && data.items) {
        const visibleQty = data.items.reduce((acc, item) => {
          return (item.properties && item.properties._hidden === 'true') ? acc : acc + item.quantity;
        }, 0);
        headerCartCount.textContent = visibleQty;
      }

    } catch (error) {
      window.location.reload();
    } finally {
      isUpdating = false;
      if (container) container.style.opacity = '1';
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || isUpdating) return;
    const row = btn.closest('tr[data-key]');
    if (!row) return;
    const input = row.querySelector('input[name="updates[]"]');
    const key = row.dataset.key;
    if (btn.classList.contains('plus')) updateCart(key, parseInt(input.value) + 1);
    if (btn.classList.contains('minus')) updateCart(key, Math.max(0, parseInt(input.value) - 1));
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'updates[]' && !isUpdating) {
      const row = e.target.closest('tr[data-key]');
      if (row) updateCart(row.dataset.key, parseInt(e.target.value) || 0);
    }
  });
});