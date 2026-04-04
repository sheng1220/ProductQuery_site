const DATA_URL = "data/products.json";
let allProducts = [];

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allProducts = await response.json();
    populateFilters(allProducts);
    renderTable(allProducts);
  } catch (err) {
    const msg = document.getElementById("empty-message");
    msg.textContent = "無法載入產品資料，請稍後再試。";
    msg.hidden = false;
    console.error("Data load error:", err);
  }
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}

function populateFilters(products) {
  fillSelect("bu-filter",  unique(products.map(p => p.bu)));
  fillSelect("mag-filter", unique(products.map(p => p.mag)));
  // For PM filter, strip _BU suffix so filter options are clean names
  fillSelect("pm-filter",  unique(products.map(p => (p.pm || "").replace(/_BU$/, ""))));
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function getFilteredProducts() {
  const query = document.getElementById("search-input").value.toLowerCase().trim();
  const bu    = document.getElementById("bu-filter").value;
  const mag   = document.getElementById("mag-filter").value;
  const pm    = document.getElementById("pm-filter").value;   // base name, no _BU

  return allProducts.filter(p => {
    const matchesQuery =
      !query ||
      (p.material             || "").toLowerCase().includes(query) ||
      (p.material_description || "").toLowerCase().includes(query) ||
      (p.description_mag      || "").toLowerCase().includes(query) ||
      (p.product_hierarchy    || "").toLowerCase().includes(query) ||
      (p.mag                  || "").toLowerCase().includes(query) ||
      (p.bu                   || "").toLowerCase().includes(query);

    const matchesBu  = !bu  || p.bu  === bu;
    const matchesMag = !mag || p.mag === mag;
    // PM filter matches both "Ryan" and "Ryan_BU"
    const matchesPm  = !pm  || (p.pm || "") === pm || (p.pm || "") === pm + "_BU";

    return matchesQuery && matchesBu && matchesMag && matchesPm;
  });
}

function renderTable(products) {
  const tbody    = document.getElementById("results-body");
  const emptyMsg = document.getElementById("empty-message");
  const countEl  = document.getElementById("result-count");

  tbody.innerHTML = "";
  countEl.textContent = `顯示 ${products.length} / ${allProducts.length} 筆`;

  if (products.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  const fragment = document.createDocumentFragment();
  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e(p.material)}</td>
      <td>${e(p.material_description)}</td>
      <td>${e(p.description_mag)}</td>
      <td>${e(p.product_hierarchy)}</td>
      <td>${e(p.bus)}</td>
      <td>${e(p.bu)}</td>
      <td>${e(p.mag)}</td>
      <td>${e(p.ag)}</td>
      <td>${e(p.cag)}</td>
      <td>${e(p.base_unit)}</td>
      <td>${e(p.length_cm)}</td>
      <td>${e(p.width_cm)}</td>
      <td>${e(p.height_cm)}</td>
      <td>${e(p.grossweight_kg)}</td>
      <td>${e(p.nettweight_kg)}</td>
      <td>${e(p.min_order_qty)}</td>
      <td>${e(p.qty_box_pc)}</td>
      <td>${pmCell(p.pm)}</td>
    `;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function pmCell(pm) {
  if (!pm) return '<span class="pm-empty">—</span>';
  if (pm.endsWith("_BU")) {
    const name = pm.slice(0, -3);
    return `<span class="pm-bu" title="Mag 未對應，以 Bu 層級指派">${e(name)}<sup>BU</sup></span>`;
  }
  return `<span class="pm-exact">${e(pm)}</span>`;
}

function e(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let debounceTimer;
function onFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => renderTable(getFilteredProducts()), 150);
}

document.getElementById("search-input").addEventListener("input", onFilterChange);
document.getElementById("bu-filter").addEventListener("change", onFilterChange);
document.getElementById("mag-filter").addEventListener("change", onFilterChange);
document.getElementById("pm-filter").addEventListener("change", onFilterChange);

loadData();
