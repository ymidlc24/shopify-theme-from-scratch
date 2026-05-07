if (!customElements.get("cart-notification")) {
  customElements.define(
    "cart-notification",
    class CartNotification extends HTMLElement {
      constructor() {
        super();
      }
    },
  );
}

function formatMoney(cents) {
  return (
    "₱" +
    new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(
      cents / 100,
    )
  );
}

function updateProductUI(section, triggeredBy = null) {
  const sectionId = section.dataset.section;
  const variantJsonElement = document.getElementById(`VariantJson-${sectionId}`);
  const cartInventoryElement = document.getElementById(`CartInventoryJson-${sectionId}`);
  if (!variantJsonElement) return;

  const variantData = JSON.parse(variantJsonElement.textContent);
  const cartData = cartInventoryElement ? JSON.parse(cartInventoryElement.textContent) : { items: [] };

  const productId = section.dataset.productId;
  const mainItemInCart = cartData.items.find(item => String(item.product_id) === productId && !item.properties._hidden);

  if (mainItemInCart && !section.dataset.userInteracted) {
    const variantSelect = section.querySelector(".variant-select");
    if (variantSelect) {
      variantSelect.value = mainItemInCart.variant_options;
    }

    const addonString = mainItemInCart.properties["Add-ons"] || "";
    if (addonString !== "None") {
      const addonArray = addonString.split(',').map(name => name.trim());
      section.querySelectorAll(".addon-checkbox").forEach(cb => {
        cb.checked = addonArray.includes(cb.dataset.addonName.trim());
      });
    }
  }

  const currentOptions = Array.from(section.querySelectorAll(".variant-select")).map((s) => s.value);
  const matchedVariant = variantData.find((v) => currentOptions.every((opt, i) => v.options[i] === opt));

  const buyButton = section.querySelector('[type="submit"]');

  if (!matchedVariant) {
    if (buyButton) {
      buyButton.disabled = true;
      buyButton.textContent = "UNAVAILABLE";
    }
    return;
  }

  const productImage = document.getElementById(`product-image-${sectionId}`);
  if (productImage && matchedVariant.featured_image) {
    const newSrc = matchedVariant.featured_image.src || matchedVariant.featured_image;
    if (newSrc && productImage.src !== newSrc) {
       productImage.src = newSrc;
    }
  }

  const activeAddons = Array.from(section.querySelectorAll(".addon-checkbox:checked"));
  const currentAddonString = activeAddons.map((cb) => cb.dataset.addonName).join(", ") || "None";

  const existingItem = cartData.items.find(item => 
    item.variant_id === matchedVariant.id && 
    item.properties && item.properties["Add-ons"] === currentAddonString
  );

  const qtyInput = section.querySelector('input[name="quantity"]');
  
  if (!section.dataset.userInteracted || triggeredBy === 'selection') {
    if (qtyInput) {
      qtyInput.value = existingItem ? existingItem.quantity : 1;
    }
    
    if (triggeredBy === 'selection') {
        const cartAddonsForVariant = existingItem ? (existingItem.properties["Add-ons"] || "None") : "None";
        const addonArray = cartAddonsForVariant.split(',').map(name => name.trim());
        section.querySelectorAll(".addon-checkbox").forEach(cb => {
          cb.checked = cartAddonsForVariant === "None" ? false : addonArray.includes(cb.dataset.addonName.trim());
        });
    }
  }

  section.dataset.userInteracted = "true";

  if (buyButton) {
    buyButton.dataset.variantId = matchedVariant.id;
    buyButton.disabled = !matchedVariant.available;
    buyButton.textContent = existingItem ? "UPDATE CART" : (matchedVariant.available ? "ADD TO CART" : "OUT OF STOCK");
  }

  const priceElement = document.getElementById(`product-price-${sectionId}`);
  if (priceElement) {
    const addonTotalPrice = activeAddons.reduce((sum, el) => sum + parseInt(el.dataset.addonPrice || 0), 0);
    const quantity = qtyInput ? parseInt(qtyInput.value) : 1;
    const totalPrice = (matchedVariant.price + addonTotalPrice) * quantity;
    priceElement.textContent = formatMoney(totalPrice);
  }
}

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "product-form") return;
  e.preventDefault();

  const section = e.target.closest("[data-section]");
  const sectionId = section.dataset.section;
  const addonMapElement = document.getElementById(`AddonMap-${sectionId}`);

  const addonMap = addonMapElement ? JSON.parse(addonMapElement.textContent) : {};
  const btn = e.target.querySelector('[type="submit"]');
  const originalText = "ADD TO CART";

  btn.disabled = true;
  btn.textContent = "Processing...";

  const mainId = btn.dataset.variantId;
  const qtyInput = e.target.querySelector('input[name="quantity"]');
  const qty = qtyInput ? parseInt(qtyInput.value) : 1;
  const activeAddons = Array.from(e.target.querySelectorAll(".addon-checkbox:checked"));

  const addonFingerprint = activeAddons.map((cb) => cb.dataset.addonName).sort().join("|") || "none";
  const bundleId = `b_${mainId}_${addonFingerprint}`;

  let items = [{
    id: parseInt(mainId),
    quantity: qty,
    properties: {
      "Add-ons": activeAddons.map((cb) => cb.dataset.addonName).join(", ") || "None",
      _bundleId: bundleId,
    },
  }];

  activeAddons.forEach((cb) => {
    const name = cb.dataset.addonName;
    if (addonMap[name]) {
      items.push({
        id: parseInt(addonMap[name]),
        quantity: qty,
        properties: { _hidden: "true", _parentBundle: bundleId },
      });
    }
  });

  try {
    const cartRes = await fetch("/cart.js");
    const currentCart = await cartRes.json();

    const existingMainItem = currentCart.items.find(
      (item) => item.properties && item.properties._bundleId === bundleId,
    );

    let response; 

    if (existingMainItem) {
      const updates = {};
      updates[existingMainItem.key] = qty;
      currentCart.items.forEach((item) => {
        if (item.properties && item.properties._parentBundle === bundleId) {
          updates[item.key] = qty;
        }
      });
      response = await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updates }),
      });
    } else {
      response = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      });
    }

    const data = await response.json();

    if (response.ok) {
      if (typeof window.refreshHeaderCartCount === "function") {
        window.refreshHeaderCartCount();
      }

      const priceElement = document.getElementById(`product-price-${sectionId}`);
      const currentPriceText = priceElement ? priceElement.textContent : "";
      const mainItem = existingMainItem || (data.items ? data.items[0] : null);

      let modal = document.getElementById("cart-notification");
      if (!modal) {
        const sectionResponse = await fetch(`${window.location.pathname}?sections=cart-notification`);
        const sectionData = await sectionResponse.json();
        const html = new DOMParser().parseFromString(sectionData["cart-notification"], "text/html");
        modal = html.querySelector("cart-notification");
        if (modal) document.body.appendChild(modal);
      }

      if (modal && mainItem) {
        modal.querySelector("#modal-product-title").textContent = mainItem.product_title || mainItem.title;
        modal.querySelector("#modal-product-image").src = mainItem.image;
        modal.querySelector("#modal-product-qty").textContent = `Qty: ${qty}`;
        modal.querySelector("#modal-product-price").textContent = currentPriceText;
        modal.classList.remove("tw:hidden");
      }

      const updatedCartRes = await fetch("/cart.js");
      const updatedCart = await updatedCartRes.json();
      const inventoryLedger = document.getElementById(`CartInventoryJson-${sectionId}`);
      if (inventoryLedger) inventoryLedger.textContent = JSON.stringify(updatedCart);
      
      updateProductUI(section);
      btn.disabled = false;
      btn.textContent = originalText;
    } else {
      throw new Error(data.description);
    }
  } catch (err) {
    console.error("Submission failed:", err);
    btn.disabled = false;
    btn.textContent = "Error - Try Again";
    setTimeout(() => { btn.textContent = originalText; }, 3000);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll("[data-section]");
  sections.forEach((section) => updateProductUI(section));
});

["change", "input"].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    const section = e.target.closest("[data-section]");
    if (!section) return;

    let type = 'selection'; 
    if (e.target.name === 'quantity') type = 'quantity';
    if (e.target.classList.contains('addon-checkbox')) type = 'addon';

    updateProductUI(section, type);
  });
});