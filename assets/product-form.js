if (!customElements.get('cart-notification')) {
  customElements.define('cart-notification', class CartNotification extends HTMLElement {
    constructor() { super(); }
  });
}

function formatMoney(cents) {
  return "₱" + new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(cents / 100);
}

function updateProductUI(section) {
  const sectionId = section.dataset.section;
  const variantJsonElement = document.getElementById(`VariantJson-${sectionId}`);
  if (!variantJsonElement) return;

  const variantData = JSON.parse(variantJsonElement.textContent);
  const currentOptions = Array.from(section.querySelectorAll(".variant-select")).map((s) => s.value);
  const matchedVariant = variantData.find((v) => currentOptions.every((opt, i) => v.options[i] === opt));
  const buyButton = section.querySelector('[type="submit"]');

  const activeAddons = Array.from(section.querySelectorAll(".addon-checkbox:checked"));
  const addonTotalCents = activeAddons.reduce((sum, el) => sum + parseInt(el.dataset.addonPrice || 0), 0);

  if (matchedVariant) {
    buyButton.dataset.variantId = matchedVariant.id;
    const priceElement = document.getElementById(`product-price-${sectionId}`);
    if (priceElement) {
      priceElement.textContent = formatMoney(matchedVariant.price + addonTotalCents);
    }
    buyButton.disabled = !matchedVariant.available;
    buyButton.textContent = matchedVariant.available ? "Add to Cart" : "Out of Stock";
  }
}

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "product-form") return;
  e.preventDefault();

  const section = e.target.closest("[data-section]");
  const sectionId = section.dataset.section;
  const addonMapElement = document.getElementById(`AddonMap-${sectionId}`);
  if (!addonMapElement) return;

  const addonMap = JSON.parse(addonMapElement.textContent);
  const btn = e.target.querySelector('[type="submit"]');
  const originalText = "Add to Cart";

  btn.disabled = true;
  btn.textContent = "Processing...";

  const mainId = btn.dataset.variantId;
  const qtyInput = e.target.querySelector('input[name="quantity"]');
  const qty = qtyInput ? parseInt(qtyInput.value) : 1;
  const activeCheckboxes = Array.from(e.target.querySelectorAll(".addon-checkbox:checked"));

  const addonFingerprint = activeCheckboxes.map((cb) => cb.dataset.addonName).sort().join("|") || "none";
  const bundleId = `b_${mainId}_${addonFingerprint}`;

  let items = [{
    id: parseInt(mainId),
    quantity: qty,
    properties: {
      "Add-ons": activeCheckboxes.map((cb) => cb.dataset.addonName).join(", ") || "None",
      _bundleId: bundleId,
    },
  }];

  activeCheckboxes.forEach((cb) => {
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
    const response = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items }),
    });

    const data = await response.json();

    if (response.ok) {
      // FIX: Since main-product adds an ARRAY, we grab the first item (The Drink)
      const mainItem = data.items[0];

      let modal = document.getElementById("cart-notification");
      if (!modal) {
          const sectionResponse = await fetch(`${window.location.pathname}?sections=cart-notification`);
          const sectionData = await sectionResponse.json();
          const html = new DOMParser().parseFromString(sectionData["cart-notification"], "text/html");
          modal = html.querySelector("cart-notification");
          document.body.appendChild(modal);
      }

      // Inject data from the first item in the array
      modal.querySelector("#modal-product-title").textContent = mainItem.product_title;
      modal.querySelector("#modal-product-image").src = mainItem.image;
      modal.querySelector("#modal-product-qty").textContent = `Qty: ${mainItem.quantity}`;
      
      // Calculate total for JUST the items added in THIS click
      const bundleTotalCents = data.items.reduce((sum, item) => sum + item.final_line_price, 0);
      modal.querySelector("#modal-product-price").textContent = formatMoney(bundleTotalCents);

      // Update Header Bubble (Filtering out hidden add-ons)
      fetch('/cart.js?v=' + new Date().getTime())
        .then(res => res.json())
        .then(cart => {
          const headerCartCount = document.querySelector(".cart-count");
          if (headerCartCount) {
            const visibleQty = cart.items.reduce((acc, item) => {
              const isHidden = item.properties && item.properties._hidden === "true";
              return isHidden ? acc : acc + item.quantity;
            }, 0);
            headerCartCount.textContent = visibleQty;
          }
        });

      modal.classList.remove("tw:hidden");
      btn.disabled = false;
      btn.textContent = originalText;

      modal.querySelectorAll(".modal-close-trigger").forEach((el) => {
        el.addEventListener("click", () => modal.classList.add("tw:hidden"));
      });
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
    if (section && (e.target.classList.contains("variant-select") || e.target.classList.contains("addon-checkbox"))) {
      updateProductUI(section);
    }
  });
});