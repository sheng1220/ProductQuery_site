const DATA_URL = "data/products.json";
const PAGE_SIZE = 100;

let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let sortKey = null;
let sortDirection = 'asc';

const NUMERIC_FIELDS = new Set([
  'length_cm', 'width_cm', 'height_cm',
  'grossweight_kg', 'nettweight_kg',
  'min_order_qty', 'qty_box_pc'
]);

const FIELD_LABELS = [
  ["material",             "Material"],
  ["material_description", "Description"],
  ["pm",                   "PM"],
  ["description_mag",      "Description MAG"],
  ["product_hierarchy",    "Product Hierarchy"],
  ["bus",                  "BG"],
  ["bu",                   "BU"],
  ["mag",                  "Mag"],
  ["ag",                   "AG"],
  ["cag",                  "CAG"],
  ["base_unit",            "Unit"],
  ["length_cm",            "L (cm)"],
  ["width_cm",             "W (cm)"],
  ["height_cm",            "H (cm)"],
  ["grossweight_kg",       "Gross (kg)"],
  ["nettweight_kg",        "Net (kg)"],
  ["min_order_qty",        "MOQ"],
  ["qty_box_pc",           "Qty/Box"],
];

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allProducts = data.products;

    if (data.generated_at) {
      const d = new Date(data.generated_at);
      const formatted = d.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
      const orderbook = data.orderbook_file ? `Orderbook：${data.orderbook_file}` : "";
      const rr = data.rr_file ? `R&R：${data.rr_file}` : "";
      const sources = [orderbook, rr].filter(Boolean).join("　|　");
      document.getElementById("data-date").textContent =
        `資料更新時間：${formatted}　|　${sources}`;
    }

    populateFilters(allProducts);
    applyFilters();
    initStickyHeader();
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
  fillSelect("bg-filter",  unique(products.map(p => p.bus)));
  fillSelect("bu-filter",  unique(products.map(p => p.bu)));
  fillSelect("mag-filter", unique(products.map(p => p.mag)));
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

function applyFilters() {
  const query = document.getElementById("search-input").value.toLowerCase().trim();
  const bg    = document.getElementById("bg-filter").value;
  const bu    = document.getElementById("bu-filter").value;
  const mag   = document.getElementById("mag-filter").value;
  const pm    = document.getElementById("pm-filter").value;

  filteredProducts = allProducts.filter(p => {
    const matchesQuery =
      !query ||
      (p.material             || "").toLowerCase().includes(query) ||
      (p.material_description || "").toLowerCase().includes(query);

    const matchesBg  = !bg  || p.bus === bg;
    const matchesBu  = !bu  || p.bu  === bu;
    const matchesMag = !mag || p.mag === mag;
    const matchesPm  = !pm  || (p.pm || "") === pm || (p.pm || "") === pm + "_BU";

    return matchesQuery && matchesBg && matchesBu && matchesMag && matchesPm;
  });

  currentPage = 1;
  sortProducts();
  renderPage();
}

function sortProducts() {
  if (!sortKey) return;
  const isNumeric = NUMERIC_FIELDS.has(sortKey);
  const dir = sortDirection === 'asc' ? 1 : -1;
  filteredProducts.sort((a, b) => {
    let va = a[sortKey] ?? '';
    let vb = b[sortKey] ?? '';
    if (isNumeric) {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb)) * dir;
  });
}

function handleThClick(e) {
  const th = e.target.closest('th');
  if (!th) return;
  const idx = Array.from(th.parentElement.children).indexOf(th);
  const fieldKey = FIELD_LABELS[idx]?.[0];
  if (!fieldKey) return;
  if (sortKey === fieldKey) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = fieldKey;
    sortDirection = 'asc';
  }
  sortProducts();
  currentPage = 1;
  renderPage();
}

function updateSortIndicators() {
  document.querySelectorAll('#results-table thead th, #sticky-header-table thead th').forEach((th, i) => {
    const key = FIELD_LABELS[i]?.[0];
    const existing = th.querySelector('.sort-arrow');
    if (existing) existing.remove();
    if (key === sortKey) {
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      th.appendChild(arrow);
    }
  });
}

function renderPage() {
  const tbody    = document.getElementById("results-body");
  const emptyMsg = document.getElementById("empty-message");
  const countEl  = document.getElementById("result-count");

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = "";

  countEl.textContent = filteredProducts.length > 0
    ? `共 ${filteredProducts.length} 筆，第 ${currentPage} / ${totalPages} 頁`
    : `共 0 筆`;

  if (filteredProducts.length === 0) {
    emptyMsg.hidden = false;
    updatePagination(0, 1);
    return;
  }
  emptyMsg.hidden = true;

  const fragment = document.createDocumentFragment();
  pageItems.forEach(p => {
    const tr = document.createElement("tr");
    tr.dataset.idx = JSON.stringify(p); // store product for modal
    tr.innerHTML = `
      <td>${e(p.material)}</td>
      <td>${e(p.material_description)}</td>
      <td>${pmCell(p.pm)}</td>
      <td class="desktop-only">${e(p.description_mag)}</td>
      <td class="desktop-only">${e(p.product_hierarchy)}</td>
      <td class="desktop-only">${e(p.bus)}</td>
      <td class="desktop-only">${e(p.bu)}</td>
      <td class="desktop-only">${e(p.mag)}</td>
      <td class="desktop-only">${e(p.ag)}</td>
      <td class="desktop-only">${e(p.cag)}</td>
      <td class="desktop-only">${e(p.base_unit)}</td>
      <td class="desktop-only">${e(p.length_cm)}</td>
      <td class="desktop-only">${e(p.width_cm)}</td>
      <td class="desktop-only">${e(p.height_cm)}</td>
      <td class="desktop-only">${e(p.grossweight_kg)}</td>
      <td class="desktop-only">${e(p.nettweight_kg)}</td>
      <td class="desktop-only">${e(p.min_order_qty)}</td>
      <td class="desktop-only">${e(p.qty_box_pc)}</td>
      <td class="mobile-only expand-btn">›</td>
    `;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);

  updatePagination(filteredProducts.length, totalPages);
  updateSortIndicators();
  syncStickyWidths();
}

document.querySelector('#results-table thead').addEventListener('click', handleThClick);

// Click delegation on tbody — works for both mobile expand and desktop (no-op)
document.getElementById("results-body").addEventListener("click", function(ev) {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  // On mobile, any tap on a row opens the detail modal
  if (window.innerWidth <= 768) {
    const p = JSON.parse(tr.dataset.idx);
    showDetail(p);
  }
});

function showDetail(p) {
  const body = document.getElementById("detail-body");
  body.innerHTML = FIELD_LABELS.map(([key, label]) => {
    let val = p[key] || "";
    if (key === "pm") {
      return `<div class="detail-row">
        <span class="detail-label">${label}</span>
        <span class="detail-value">${pmCell(p.pm)}</span>
      </div>`;
    }
    return `<div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${e(val) || '<span class="pm-empty">—</span>'}</span>
    </div>`;
  }).join("");

  const overlay = document.getElementById("detail-overlay");
  overlay.hidden = false;
  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeDetail() {
  const overlay = document.getElementById("detail-overlay");
  overlay.classList.remove("open");
  overlay.addEventListener("transitionend", () => { overlay.hidden = true; }, { once: true });
}

document.getElementById("detail-close").addEventListener("click", closeDetail);
document.getElementById("detail-overlay").addEventListener("click", function(ev) {
  if (ev.target === this) closeDetail();
});

function updatePagination(total, totalPages) {
  document.getElementById("btn-prev").disabled = currentPage <= 1;
  document.getElementById("btn-next").disabled = currentPage >= totalPages;
  const pageInput = document.getElementById("page-input");
  pageInput.value = currentPage;
  pageInput.max = totalPages;
  document.getElementById("page-total").textContent = `/ ${totalPages}`;
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

// Pagination controls
document.getElementById("btn-prev").addEventListener("click", () => {
  if (currentPage > 1) { currentPage--; renderPage(); }
});
document.getElementById("btn-next").addEventListener("click", () => {
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  if (currentPage < totalPages) { currentPage++; renderPage(); }
});
document.getElementById("page-input").addEventListener("change", function () {
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const v = parseInt(this.value);
  if (!isNaN(v) && v >= 1 && v <= totalPages) { currentPage = v; renderPage(); }
});

document.getElementById('btn-export').addEventListener('click', exportToExcel);

function exportToExcel() {
  if (filteredProducts.length === 0) return;
  const headers = FIELD_LABELS.map(([, label]) => label);
  const keys = FIELD_LABELS.map(([key]) => key);
  const rows = filteredProducts.map(p =>
    keys.map(key => p[key] ?? '')
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => {
    let maxLen = h.length;
    for (let r = 0; r < Math.min(rows.length, 100); r++) {
      const len = String(rows[r][i]).length;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(maxLen + 2, 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '產品查詢');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `產品查詢_${dateStr}.xlsx`);
}

let debounceTimer;
function onFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 200);
}

document.getElementById("search-input").addEventListener("input", onFilterChange);
document.getElementById("bg-filter").addEventListener("change", applyFilters);
document.getElementById("bu-filter").addEventListener("change", applyFilters);
document.getElementById("mag-filter").addEventListener("change", applyFilters);
document.getElementById("pm-filter").addEventListener("change", applyFilters);

// Sticky header (clone-based)
let stickyClone = null;

function initStickyHeader() {
  const wrapper = document.createElement('div');
  wrapper.id = 'sticky-header-wrapper';

  const cloneTable = document.createElement('table');
  cloneTable.id = 'sticky-header-table';
  const cloneThead = document.querySelector('#results-table thead').cloneNode(true);
  cloneTable.appendChild(cloneThead);
  wrapper.appendChild(cloneTable);
  document.body.appendChild(wrapper);
  stickyClone = { wrapper, cloneTable };

  // Sort clicks on cloned header
  cloneThead.addEventListener('click', handleThClick);

  // Sync horizontal scroll
  const tableWrapper = document.querySelector('.table-wrapper');
  tableWrapper.addEventListener('scroll', () => {
    wrapper.scrollLeft = tableWrapper.scrollLeft;
  });

  // Show/hide based on real thead visibility
  const thead = document.querySelector('#results-table thead');
  const observer = new IntersectionObserver(([entry]) => {
    wrapper.classList.toggle('visible', !entry.isIntersecting);
  }, { threshold: 0 });
  observer.observe(thead);
}

function syncStickyWidths() {
  if (!stickyClone) return;
  const tableWrapper = document.querySelector('.table-wrapper');
  const rect = tableWrapper.getBoundingClientRect();
  stickyClone.wrapper.style.left = rect.left + 'px';
  stickyClone.wrapper.style.width = rect.width + 'px';

  const realThs = document.querySelectorAll('#results-table thead th');
  const cloneThs = document.querySelectorAll('#sticky-header-table thead th');
  realThs.forEach((th, i) => {
    if (cloneThs[i]) cloneThs[i].style.width = th.getBoundingClientRect().width + 'px';
  });
  stickyClone.cloneTable.style.width =
    document.getElementById('results-table').getBoundingClientRect().width + 'px';
}

loadData();
window.addEventListener('resize', syncStickyWidths);
