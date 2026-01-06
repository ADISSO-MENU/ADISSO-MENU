
    // =========================
    // CONFIG
    // =========================
    const SUPABASE_URL = "https://ixqtbndjbqbkapghoszx.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_PAK28m8_Q4BpETQ0YWHjDg_oifolhDG";

    const TABLE_NAME = "menu_items_csv";
    const IMAGE_BUCKET = "menu-images-test";

    // =========================
    // STATE
    // =========================
    window.__db = window.__db || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const db = window.__db;

    let allItems = [];
    let currentCategory = "Food";
    let currentSubcategory = null;
    // CART state (stored)
    const CART_KEY = "adi_menu_cart_v1";
    const ORDER_KEY = "adi_menu_ordercode_v1";

    // =========================
    // HELPERS
    // =========================
    const el = (id) => document.getElementById(id);

    function slugify(str) {
      return String(str || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    function priceUSD(value) {
      const n = Number(value);
      if (Number.isNaN(n)) return "";
      return `$${n.toFixed(2)}`;
    }

    function groupBy(arr, keyFn) {
      const map = new Map();
      for (const item of arr) {
        const key = keyFn(item) ?? "Other";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      return map;
    }

    function sortByName(items) {
      return [...items].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    }

    function getPublicImageUrl(image_path) {
      if (!image_path) return null;
      const safePath = String(image_path)
        .trim()
        .split("/")
        .map(part => encodeURIComponent(part.trim()))
        .join("/");
      return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${safePath}`;
    }

    function resolveImageUrl(item) {
      return item.image_path ? getPublicImageUrl(item.image_path) : null;
    }

    // =========================
    // CART FUNCTIONS
    // =========================
    function loadCart() {
      try { return JSON.parse(localStorage.getItem(CART_KEY) || "{}"); }
      catch { return {}; }
    }

    function saveCart(cart) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      updateCartBadge();
    }

    function getOrderCode() {
      let code = localStorage.getItem(ORDER_KEY);
      if (!code) {
        code = generateOrderCode();
        localStorage.setItem(ORDER_KEY, code);
      }
      return code;
    }

    function generateOrderCode() {
      const n = Math.floor(100000 + Math.random() * 900000);
      return `ADI-${n}`;
    }

    function cartCount(cart) {
      return Object.values(cart).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
    }

    function updateCartBadge() {
      const cart = loadCart();
      el("cartCountBadge").textContent = cartCount(cart);
    }

    function addToCart(item) {
      const cart = loadCart();
      const id = String(item.id);

      if (!cart[id]) {
        cart[id] = {
          id: item.id,
          name: item.name || "",
          price: Number(item.price) || 0,
          image_path: item.image_path || null,
          qty: 0
        };
      }
      cart[id].qty += 1;
      saveCart(cart);
    }

    function changeQty(itemId, delta) {
      const cart = loadCart();
      const id = String(itemId);
      if (!cart[id]) return;

      cart[id].qty = (Number(cart[id].qty) || 0) + delta;
      if (cart[id].qty <= 0) delete cart[id];

      saveCart(cart);
      renderCartModal();
    }

    function clearCart() {
      localStorage.removeItem(CART_KEY);
      updateCartBadge();
      renderCartModal();
    }

    function calcTotal(cart) {
      return Object.values(cart).reduce((sum, x) => sum + (Number(x.price)||0) * (Number(x.qty)||0), 0);
    }

function renderCartModal() {
  const cart = loadCart();
  const items = Object.values(cart);

  const list = el("cartList");
  const empty = el("cartEmpty");



  list.innerHTML = "";

  if (items.length === 0) {
    empty.style.display = "block";
  } else {
    empty.style.display = "none";

    for (const it of items) {
      const imgUrl = it.image_path ? getPublicImageUrl(it.image_path) : null;
      const finalImgUrl = imgUrl || "./assets/placeholder.webp";
      const note = (it.note || "").trim();

      const row = document.createElement("div");
row.className = "list-group-item d-flex align-items-start justify-content-between gap-3";

row.innerHTML = `
  <div class="d-flex align-items-start gap-3" style="min-width:0; flex:1;">
    <img class="cart-item-img" src="${finalImgUrl}"
         onerror="this.onerror=null;this.src='./assets/placeholder.webp';" alt="">

    <div style="min-width:0; flex:1;">
      <div class="fw-semibold cart-item-name">${it.name}</div>

      <button class="btn btn-link p-0 text-decoration-none add-note-btn"
              data-note-edit="${it.id}">
        Add note
      </button>

      ${it.note ? `<div class="small text-muted fst-italic">Note: ${it.note}</div>` : ""}
    </div>
  </div>

  <div class="d-flex align-items-center gap-2 flex-nowrap" style="white-space:nowrap;">
  <button class="btn btn-sm btn-outline-secondary" data-cart-dec="${it.id}">−</button>
  <span class="fw-semibold" style="min-width:24px; text-align:center;">${it.qty}</span>
  <button class="btn btn-sm btn-outline-secondary" data-cart-inc="${it.id}">+</button>

  <div class="fw-bold ms-2">
    ${priceUSD((Number(it.price)||0) * (Number(it.qty)||0))}
  </div>
</div>

`;


      list.appendChild(row);
    }
  }

  el("cartTotal").textContent = priceUSD(calcTotal(cart));
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
let currentNoteItemId = null;

function setItemNote(itemId, noteText){
  const cart = loadCart();
  const id = String(itemId);
  if (!cart[id]) return;

  const t = String(noteText || "").trim();
  if (t) cart[id].note = t;
  else delete cart[id].note;

  saveCart(cart);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-note-edit]");
  if (!btn) return;

  const itemId = btn.getAttribute("data-note-edit");
  const cart = loadCart();
  const it = cart[String(itemId)];
  if (!it) return;

  currentNoteItemId = String(itemId);

  el("noteItemTitle").textContent = it.name || "Item";
  el("noteText").value = it.note || "";

  const modal = new bootstrap.Modal(document.getElementById("noteModal"));
  modal.show();
});

el("saveNoteBtn").addEventListener("click", () => {
  if (!currentNoteItemId) return;
  setItemNote(currentNoteItemId, el("noteText").value);
  renderCartModal();
  bootstrap.Modal.getInstance(document.getElementById("noteModal"))?.hide();
});

el("clearNoteBtn").addEventListener("click", () => {
  if (!currentNoteItemId) return;
  setItemNote(currentNoteItemId, "");
  renderCartModal();
  bootstrap.Modal.getInstance(document.getElementById("noteModal"))?.hide();
});

    // =========================
    // FETCH
    // =========================
    async function fetchMenuItems() {
      el("statusText").textContent = "Loading menu from database…";

      const { data, error } = await db
        .from(TABLE_NAME)
        .select("id, category, subcategory, subcategory_order, name, description, price, image_path, is_available, name_ar, subcategory_ar")
        .eq("is_available", true);

      if (error) {
        console.error("Supabase error:", error);
        el("statusText").textContent = "Failed to load menu.";
        el("content").innerHTML = `
          <div class="alert alert-danger">
            <div class="fw-semibold mb-2">Could not load menu items</div>
            <pre class="mb-0">${JSON.stringify(error, null, 2)}</pre>
          </div>`;
        return;
      }

      allItems = data || [];
      el("statusText").style.display = "none";
    }

    // =========================
    // DESCRIPTION EXPAND
    // =========================
    document.addEventListener("click", (e) => {
      const wrap = e.target.closest(".item-desc-wrap");
      if (!wrap) return;

      const desc = wrap.querySelector(".item-desc");
      if (!desc) return;

      desc.classList.toggle("expanded");
      wrap.classList.toggle("expanded");
    });

    function markTruncatedDescriptions() {
      requestAnimationFrame(() => {
        document.querySelectorAll(".item-desc-wrap").forEach(wrap => {
          wrap.classList.remove("truncated");
          const desc = wrap.querySelector(".item-desc");
          if (!desc) return;

          if (!desc.classList.contains("expanded") && desc.scrollHeight > desc.clientHeight + 1) {
            wrap.classList.add("truncated");
          }
        });
      });
    }
function orderViaWhatsApp() {
  const cart = loadCart();
  const items = Object.values(cart);

  if (items.length === 0) {
    alert("Your cart is empty");
    return;
  }

  let header = "";

  if (orderType === "Dine In") {
    header = tableNumber
      ? `🪑 Dine In – Table: ${tableNumber}\n`
      : `🪑 Dine In\n`;
  } else if (orderType === "Delivery") {
    header = `🚚 Delivery\n`;
  } else if (orderType === "Take Away") {
    header = `🧺 Take Away\n`;
  }

  let message = header + "🧾 *New Order*\n";

  items.forEach(item => {
    const note =
      item.note && item.note.trim()
        ? ` (${item.note.trim()})`
        : "";

    message += `• ${item.name} ×${item.qty}${note}\n`;
  });

  const phone = "96176012231";
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}


let orderType = "";
let tableNumber = "";

document.getElementById("dineInBtn").onclick = () => {
  orderType = "Dine In";
  document.getElementById("tableNumberWrap").classList.remove("d-none");
};

document.getElementById("takeAwayBtn").onclick = () => {
  orderType = "Take Away";
  tableNumber = "";
  document.getElementById("tableNumberWrap").classList.add("d-none");
};

document.getElementById("deliveryBtn").onclick = () => {
  orderType = "Delivery";
  tableNumber = "";
  document.getElementById("tableNumberWrap").classList.add("d-none");
};

document.getElementById("confirmOrderType").onclick = () => {
  if (!orderType) {
    alert("Please select order type");
    return;
  }

if (orderType === "Dine In") {
  tableNumber = document.getElementById("tableNumberInput").value.trim();
}

  orderViaWhatsApp();
};


    // =========================
    // RENDER
    // =========================
    function renderCategoryButtons() {
      document.querySelectorAll(".category-btn").forEach(btn => {
        const cat = btn.getAttribute("data-category");
        btn.classList.toggle("active", cat === currentCategory);
      });
    }

function renderSubcategoryStrip(subcategories) {
  const strip = el("subcatStrip");
  strip.innerHTML = "";

  subcategories.forEach((sub, index) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-primary subcat-chip";
    btn.textContent = sub;

    if (sub === currentSubcategory) btn.classList.add("active");

    btn.onclick = () => {
      currentSubcategory = sub;
      renderSubcategoryStrip(subcategories);
      renderSubcategoryContent();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    strip.appendChild(btn);

    // Auto-select first subcategory
    if (index === 0 && !currentSubcategory) {
      currentSubcategory = sub;
    }
  });
}


function renderSubcategoryContent() {
  const content = el("content");
  content.innerHTML = "";

  if (!currentSubcategory) return;

  const items = allItems.filter(item =>
    String(item.category || "").toLowerCase() === currentCategory.toLowerCase() &&
    String(item.subcategory || "Other") === currentSubcategory
  );

  if (items.length === 0) {
    content.innerHTML = `<div class="text-muted">No items found.</div>`;
    return;
  }

  const section = document.createElement("section");
  section.className = "mb-4 fade-in";

const firstItem = items[0];
const ar = firstItem?.subcategory_ar?.trim();

section.innerHTML = `
  <h2 class="subcat-title mb-3">
    ${currentSubcategory}
    ${ar ? `<span class="subcat-ar"> - ${ar}</span>` : ""}
  </h2>
  <div class="row g-3" id="itemsGrid"></div>
`;


  content.appendChild(section);

  const grid = document.getElementById("itemsGrid");

  items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  items.forEach(item => {
    const imgUrl = resolveImageUrl(item) || "./assets/placeholder.webp";

    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";

    col.innerHTML = `
      <div class="card menu-card h-100">
        <img
  src="${imgUrl}"
  class="item-img"
  loading="lazy"
  style="cursor: zoom-in;"
  data-bs-toggle="modal"
  data-bs-target="#imgModal"
  data-fullimg="${imgUrl}"
  onerror="this.onerror=null;this.src='./assets/placeholder.webp';"
/>

        <div class="card-body">
          <div class="item-name fw-semibold">${item.name ?? ""}</div>
          ${item.name_ar ? `<div class="item-name-ar">${item.name_ar}</div>` : ""}
          ${item.description ? `
            <div class="item-desc-wrap">
              <span class="item-desc">${item.description}</span>
              <span class="desc-more">more</span>
            </div>` : ""}
          <div class="d-flex justify-content-between align-items-center mt-2">
            <div class="price">${priceUSD(item.price)}</div>
            <button class="order-btn btn btn-sm btn-outline-dark"
              data-add-to-cart="${item.id}">
              Add Order
            </button>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(col);
  });

  markTruncatedDescriptions();
}

function renderCurrentCategory() {
  renderCategoryButtons();

  const itemsForCategory = allItems.filter(x =>
    String(x.category || "").toLowerCase() === currentCategory.toLowerCase()
  );

  const grouped = groupBy(itemsForCategory, x => x.subcategory || "Other");
  const subcategories = Array.from(grouped.keys());

  currentSubcategory = null; // reset when changing category

  renderSubcategoryStrip(subcategories);
  renderSubcategoryContent();
}

function animateAddFeedback(btn){
  if (!btn) return;

  const originalText = btn.textContent.trim();
  btn.classList.add("added");
  btn.textContent = "✓ Added";
  btn.disabled = true;

  setTimeout(() => {
    btn.classList.remove("added");
    btn.textContent = originalText;   // returns to "Add Order"
    btn.disabled = false;
  }, 650);

  // badge pop
  const badge = el("cartCountBadge");
  if (badge) {
    badge.classList.remove("pop"); // restart animation
    void badge.offsetWidth;        // force reflow
    badge.classList.add("pop");
  }
}

    // =========================
    // EVENTS
    // =========================
    function wireEvents() {
      document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentCategory = btn.getAttribute("data-category");
          renderCurrentCategory();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });

      // Delegate clicks: add-to-cart / cart qty
      document.addEventListener("click", (e) => {
       const addBtn = e.target.closest("[data-add-to-cart]");
if (addBtn) {
  const id = addBtn.getAttribute("data-add-to-cart");
  const item = allItems.find(x => String(x.id) === String(id));
  if (item) {
    addToCart(item);
    animateAddFeedback(addBtn);
  }
  return;
}


        const inc = e.target.closest("[data-cart-inc]");
        if (inc) {
          changeQty(inc.getAttribute("data-cart-inc"), +1);
          return;
        }

        const dec = e.target.closest("[data-cart-dec]");
        if (dec) {
          changeQty(dec.getAttribute("data-cart-dec"), -1);
          return;
        }
      });

      // When cart modal opens
      const cartModalEl = document.getElementById("cartModal");
      cartModalEl.addEventListener("show.bs.modal", () => {
        renderCartModal();
      });

      // Clear cart
      el("clearCartBtn").addEventListener("click", () => {
        clearCart();
      });
    }

    // =========================
    // INIT
    // =========================
    (async function init() {
      updateCartBadge();
      wireEvents();
      await fetchMenuItems();
      renderCurrentCategory()
      localStorage.removeItem(CART_KEY);
      updateCartBadge();
;
    })();
const imgModal = document.getElementById("imgModal");
imgModal.addEventListener("show.bs.modal", function (event) {
  const triggerImg = event.relatedTarget;
  if (!triggerImg) return;

  const modalImg = document.getElementById("imgModalEl");
  modalImg.src = triggerImg.getAttribute("data-fullimg");
  modalImg.alt = triggerImg.alt || "";
});



document.getElementById("orderWhatsappBtn").addEventListener("click", () => {
  new bootstrap.Modal(document.getElementById("orderTypeModal")).show();
});

