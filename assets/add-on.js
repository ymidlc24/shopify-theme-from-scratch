document.addEventListener("submit", function (e) {
  const form = e.target;
  if (!form.getAttribute("action").includes("/cart/add")) return;

  const checkedAddons = form.querySelectorAll(".addon-check:checked");

  if (checkedAddons.length > 0) {
    const mainIdInput = form.querySelector('input[name="id"]');
    if (mainIdInput) {
      mainIdInput.name = "items[0]id";
    }

    checkedAddons.forEach((addon, index) => {
      let i = index + 1;

      let idInput = document.createElement("input");
      idInput.type = "hidden";
      idInput.name = `items[${i}]id`;
      idInput.value = addon.value;
      form.appendChild(idInput);

      let hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = `items[${i}]properties[_hidden]`;
      hiddenInput.value = "true";
      form.appendChild(hiddenInput);

      let parentInput = document.createElement('input');
      parentInput.type = 'hidden';
      parentInput.name = `items[${i}][properties][_parent_id]`;
      parentInput.value = mainIdValue; 
      form.appendChild(parentInput);
    });
  }
});

if (window.location.pathname.includes('/cart')) {
  document.addEventListener('DOMContentLoaded', function() {
    fetch('/cart.js')
      .then(res => res.json())
      .then(cart => {
        const items = cart.items;
        
        const parentIds = items
          .filter(item => !item.properties || !item.properties._hidden)
          .map(item => String(item.variant_id));

        let updates = {};
        let needsUpdate = false;

        items.forEach(item => {
          if (item.properties && item.properties._hidden) {
            const parentRef = String(item.properties._parent_id);
            if (!parentIds.includes(parentRef)) {
              updates[item.key] = 0;
              needsUpdate = true;
            }
          }
        });

        if (needsUpdate) {
          fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: updates })
          }).then(() => window.location.reload());
        }
      });
  });
}
