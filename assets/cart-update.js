async function refreshHeaderCartCount() {
  const countBadge = document.querySelector('.cart-count');
  try {
    const res = await fetch(window.Shopify.routes.root + 'cart.js?v=' + new Date().getTime());
    const cart = await res.json();
    
    const visibleQty = cart.items.reduce((acc, item) => {
      const isHidden = item.properties?._hidden === 'true' || item.properties?._hidden === true;
      return isHidden ? acc : acc + item.quantity;
    }, 0);

    if (countBadge) {
      countBadge.textContent = visibleQty;
      
      if (visibleQty > 0) {
        countBadge.classList.remove('tw:hidden');
      } else {
        countBadge.classList.add('tw:hidden');
      }
    }
  } catch (e) {
    console.error('Failed to refresh header cart count:', e);
  }
}

window.refreshHeaderCartCount = refreshHeaderCartCount;

document.addEventListener('DOMContentLoaded', function() {
  const cartForm = document.querySelector('#cart-form');
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
      if (!targetItem) throw new Error('Item not found');
      
      let updates = { [itemKey]: quantity };
      const bundleId = targetItem?.properties?._bundleId;
      const parentBundleId = targetItem.properties?._parentBundle;

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
      
      if (data.sections && data.sections['main-cart']) {
        const parser = new DOMParser();
        const html = parser.parseFromString(data.sections['main-cart'], 'text/html');
        const newContent = html.querySelector('#main-cart');
        if (newContent && container) {
          container.innerHTML = newContent.innerHTML;
        }
      }

      window.refreshHeaderCartCount();

    } catch (error) {
      console.error('Cart Update Error:', error);
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

  document.addEventListener('click', (e) => {
    const removeLink = e.target.closest('a[href*="/cart/change"]');
    if (!removeLink || isUpdating) return;

    e.preventDefault();

    const row = removeLink.closest('tr[data-key]');
    if (row) {
      updateCart(row.dataset.key, 0);
    }
  });
});