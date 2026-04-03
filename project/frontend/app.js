// ── DATA ──
// ── DATA ──
// ── DATA ──
let MENU = [];
let CATEGORIES = ["All"];
let cart = [];
let activeCategory = "All";
let orderCounter = Math.floor(Math.random() * 90 + 10);
const RESTAURANT_ID = 1;

// ── OFFLINE DATABASE (IndexedDB) ──
// 1. Create the local database
const dbPromise = indexedDB.open("StreetBiteDB", 1);
dbPromise.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("menu")) {
    db.createObjectStore("menu", { keyPath: "id" });
  }
};

// 2. Function to save the menu when online
function saveMenuOffline(menuItems) {
  const request = indexedDB.open("StreetBiteDB", 1);
  request.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction("menu", "readwrite");
    const store = tx.objectStore("menu");
    menuItems.forEach((item) => store.put(item));
  };
}

// 3. Function to load the menu when offline
function loadMenuOffline() {
  return new Promise((resolve) => {
    const request = indexedDB.open("StreetBiteDB", 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction("menu", "readonly");
      const store = tx.objectStore("menu");
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result);
    };
  });
}

// ── FETCH FROM BACKEND ──
// ── FETCH FROM BACKEND (With Offline Fallback) ──
async function fetchMenu() {
  try {
    // 1. Try to get live data from Python
    const response = await fetch(
      `http://127.0.0.1:8000/api/menu/${RESTAURANT_ID}`,
    );
    if (!response.ok) throw new Error("Server offline");

    MENU = await response.json();

    // 2. Success! Save a backup to the browser's hidden database
    saveMenuOffline(MENU);
    CATEGORIES = ["All", ...new Set(MENU.map((i) => i.cat))];
    console.log("🟢 Online: Menu loaded from Python");
  } catch (error) {
    // 3. If Python is unreachable, pull the backup from IndexedDB
    console.log("🔴 Offline: Loading from local browser database...");
    showToast("⚠️ Offline Mode Activated");

    MENU = await loadMenuOffline();
    CATEGORIES = ["All", ...new Set(MENU.map((i) => i.cat))];
  }
}
// ── INIT ──
async function init() {
  await fetchMenu(); // Wait for Python to send the data
  renderCatTabs(); // Then draw the tabs
  renderMenu("All"); // Then draw the menu cards
}
// ── CATEGORIES ──
function renderCatTabs() {
  const el = document.getElementById("catTabs");
  el.innerHTML = CATEGORIES.map(
    (c) => `
      <div class="cat-tab ${c === activeCategory ? "active" : ""}" onclick="selectCategory('${c}')">${c}</div>
    `,
  ).join("");
}

function selectCategory(cat) {
  activeCategory = cat;
  document.getElementById("catTitle").textContent =
    cat === "All" ? "ALL ITEMS" : cat.toUpperCase();
  renderCatTabs();
  renderMenu(cat);
}

// ── MENU ──
function renderMenu(cat) {
  const items = cat === "All" ? MENU : MENU.filter((i) => i.cat === cat);
  const el = document.getElementById("menuGrid");
  el.innerHTML = items
    .map(
      (item) => `
      <div class="menu-card" onclick="addToCart(${item.id})">

        ${
          item.image_url
            ? `<div class="card-image-container"><img src="${item.image_url}" class="card-image" alt="${item.name}"></div>`
            : `<span class="card-emoji">${item.emoji}</span>`
        }

        <div class="card-body">
          ${
            item.tag
              ? `<div class="tag ${item.spicy ? "spicy" : ""}">
            ${item.spicy ? "🌶️ " : ""}${item.tag}</div>`
              : ""
          }
          <div class="card-name">${item.name}</div>
          <div class="card-desc">${item.desc}</div>
          <div class="card-footer">
            <span class="card-price">₹${item.price.toFixed(2)}</span>
            <button class="add-btn" onclick="event.stopPropagation();addToCart(${item.id})">+</button>
          </div>
        </div>
      </div>
      `,
    )
    .join("");
}

// ── CART ──
function addToCart(id) {
  const item = MENU.find((i) => i.id === id);
  const existing = cart.find((i) => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...item, qty: 1, note: "" });
  }
  renderOrder();
  showToast(`✅ ${item.emoji || "🍔"} ${item.name} added`);
  // On mobile, expand panel slightly
  document.getElementById("orderPanel").classList.add("expanded");
}

function changeQty(id, delta) {
  const idx = cart.findIndex((i) => i.id === id);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderOrder();
}

function updateNote(id, val) {
  const item = cart.find((i) => i.id === id);
  if (item) item.note = val;
}

function clearOrder() {
  cart = [];
  renderOrder();
  showToast("🗑️ Order cleared");
}

// ── RENDER ORDER ──
function renderOrder() {
  const el = document.getElementById("orderItems");
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById("cartCount").textContent = count;

  if (cart.length === 0) {
    el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <p>No items yet.<br/>Add something from the menu!</p>
      </div>`;
  } else {
    el.innerHTML = cart
      .map(
        (item) => `
      <div class="order-item">

        ${
          item.image_url
            ? `<img src="${item.image_url}" class="item-img-sm" alt="${item.name}">`
            : `<span class="item-emoji-sm">${item.emoji}</span>`
        }

        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-price">₹${(item.price * item.qty).toFixed(2)}</div>
          <input type="text" class="item-note-input" placeholder="Special note..."
            value="${item.note}"
            oninput="updateNote(${item.id}, this.value)" />
        </div>
        <div class="item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // Totals
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  document.getElementById("subtotal").textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById("tax").textContent = `₹${tax.toFixed(2)}`;
  document.getElementById("total").textContent = `₹${total.toFixed(2)}`;

  const hasItems = cart.length > 0;
  document.getElementById("printBtn").disabled = !hasItems;
  document.getElementById("placeBtn").disabled = !hasItems;
  document.getElementById("clearBtn").disabled = !hasItems;
}

// ── PLACE ORDER ──
function placeOrder() {
  orderCounter++;
  const num = String(orderCounter).padStart(4, "0");
  document.getElementById("orderNumber").textContent = `#${num}`;
  document.getElementById("confirmModal").classList.add("open");
  buildPrintArea(num);
}

function closeModal() {
  document.getElementById("confirmModal").classList.remove("open");
}

// ── PRINT ──
function buildPrintArea(orderNum) {
  const table = document.getElementById("tableNum").value || "Walk-in";
  const type = document.getElementById("orderType").value;
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString();

  const itemsHTML = cart
    .map(
      (i) => `
      <div class="receipt-item">
        <span>${i.qty}x ${i.name}</span>
        <span>₹${(i.price * i.qty).toFixed(2)}</span>
      </div>
      ${i.note ? `<div class="receipt-item-note">Note: ${i.note}</div>` : ""}
    `,
    )
    .join("");

  document.getElementById("printArea").innerHTML = `
      <div class="receipt-logo">STREETBITE</div>
      <div class="receipt-tagline">Fresh. Hot. Now.</div>
      <div class="receipt-divider"></div>
      <div class="receipt-meta">
        <div><span>Order #</span><span><b>${orderNum || orderCounter}</b></span></div>
        <div><span>Type</span><span>${type}</span></div>
        <div><span>Table/Ticket</span><span>${table}</span></div>
        <div><span>Date</span><span>${date}</span></div>
        <div><span>Time</span><span>${time}</span></div>
      </div>
      <div class="receipt-divider"></div>
      ${itemsHTML}
      <div class="receipt-divider"></div>
      <div class="receipt-tax"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      <div class="receipt-tax"><span>Tax (8%)</span><span>₹${tax.toFixed(2)}</span></div>
      <div class="receipt-total"><span>TOTAL</span><span>₹${total.toFixed(2)}</span></div>
      <div class="receipt-divider"></div>
      <div class="receipt-barcode">||| |||| || |||</div>
      <div class="receipt-footer">Thank you for choosing StreetBite!<br/>Come back soon 🌶️</div>
    `;
}

function printReceipt() {
  if (cart.length === 0) {
    showToast("⚠️ Nothing to print!");
    return;
  }
  buildPrintArea(orderCounter);
  window.print();
}

// ── PANEL TOGGLE (MOBILE) ──
function toggleOrderPanel() {
  document.getElementById("orderPanel").classList.toggle("expanded");
}

// ── TOAST ──
function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ── START ──
init();

// ── REGISTER SERVICE WORKER ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.log("SW failed:", err));
  });
}

// ── START ──
init();
