// --- ESTADO GLOBAL ---
const state = {
    menu: [],
    cart: [],
    categories: [],
    currentUser: null,
    currentPhone: "",
    taxRate: 0.16,
    editingItemId: null,
    tempCustomItem: null,
    // Estado Admin
    adminFilterCategory: 'Todos',
    adminSearchTerm: '',
    // Catálogos
    catalogs: {
        modifierTemplates: [
            { name: "Término de la Carne", options: [{name: "Bien Cocido", price:0}, {name: "Medio", price:0}, {name: "3/4", price:0}] },
            { name: "Salsas", options: [{name: "BBQ", price:0}, {name: "Buffalo", price:0}, {name: "Mango Habanero", price:0}] },
            { name: "Refrescos", options: [{name: "Coca Cola", price:0}, {name: "Sprite", price:0}, {name: "Agua", price:0}] },
            { name: "Extras", options: [{name: "Queso Extra", price:15}, {name: "Tocino", price:20}, {name: "Aguacate", price:15}] }
        ]
    }
};

// --- DATOS POR DEFECTO ---
const defaultMenu = [
    { id: 101, name: "PASTA TOSCANA", price: 185, category: "Pastas", description: "Pollo, espinaca y tomate deshidratado.", tags: ["Chef", "Nuevo"] },
    { id: 102, name: "MERRY GIN", price: 109, category: "Mixología", description: "Ginebra con manzana y arándano.", tags: ["Nuevo"] },
    { id: 201, name: "DEDOS DE QUESO", price: 105, category: "Entradas", description: "5 pzas con salsa pomodoro." },
    { id: 301, name: "ALITAS (600g)", price: 263, category: "Alitas", description: "Con papas y aderezo.", modifiers: [{ name: "Salsa", options: [{name:"BBQ", price:0}, {name:"Buffalo", price:0}] }] },
    { id: 601, name: "PIZZA CARNIVORA", price: 309, category: "Pizzas", description: "Chorizo, tocino, salami.", tags: ["Chef"] },
    { id: 904, name: "LIMONADA", price: 45, category: "Bebidas", description: "Natural o Mineral." }
];

// --- SELECTORES ---
const elements = {
    phoneScreen: document.getElementById('phone-input-screen'),
    kioskApp: document.getElementById('kiosk-app'),
    adminScreen: document.getElementById('admin-screen'),
    phoneInput: document.getElementById('phone-number-input'),
    startOrderBtn: document.getElementById('start-order-button'),
    categoryBar: document.getElementById('category-bar'),
    menuContainer: document.getElementById('menu-container'),
    cartList: document.getElementById('cart-list'),
    emptyCartMsg: document.getElementById('empty-cart-message'),
    clearCartBtn: document.getElementById('clear-cart-button'),
    subtotalDisplay: document.getElementById('subtotal-display'),
    taxDisplay: document.getElementById('tax-display'),
    totalDisplay: document.getElementById('total-display'),
    checkoutBtn: document.getElementById('checkout-button'),
    clientNameDisplay: document.getElementById('current-client-name'),
    regModal: document.getElementById('registration-modal'),
    regName: document.getElementById('reg-name'),
    regBtn: document.getElementById('register-button'),
    customModal: document.getElementById('customization-modal'),
    customContent: document.getElementById('customization-content'),
    customTotal: document.getElementById('custom-total-price'),
    confirmCustomBtn: document.getElementById('confirm-custom-button'),
    cancelCustomBtn: document.getElementById('cancel-custom-button'),
    paymentModal: document.getElementById('payment-modal'),
    paymentUi: document.getElementById('payment-ui'),
    paymentSuccess: document.getElementById('payment-success'),
    paymentTotal: document.getElementById('payment-total'),
    adminSidebar: document.getElementById('admin-category-sidebar'),
    adminMenuList: document.getElementById('admin-menu-list'),
    adminSearch: document.getElementById('admin-search'),
    editModal: document.getElementById('edit-item-modal'),
    editName: document.getElementById('edit-name'),
    editPrice: document.getElementById('edit-price'),
    editCategory: document.getElementById('edit-category'),
    editDesc: document.getElementById('edit-description'),
    categoryChips: document.getElementById('category-chips'),
    quickAddSelect: document.getElementById('quick-add-modifier'),
    editModifiersContainer: document.getElementById('edit-modifiers-container'),
    addModifierGroupBtn: document.getElementById('add-modifier-group-button'),
    saveItemBtn: document.getElementById('save-item-button'),
    deleteItemBtn: document.getElementById('delete-item-button'),
    cancelEditBtn: document.getElementById('cancel-edit-button')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
    resetTimer();
});

function loadData() {
    const storedMenu = localStorage.getItem('dolce_mia_menu_v6');
    state.menu = storedMenu ? JSON.parse(storedMenu) : defaultMenu;
    if (!storedMenu) saveMenu();
}

function saveMenu() {
    localStorage.setItem('dolce_mia_menu_v6', JSON.stringify(state.menu));
}

function initEventListeners() {
    // Kiosco Events
    elements.phoneInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
        elements.startOrderBtn.disabled = e.target.value.length < 8;
    });
    elements.startOrderBtn.addEventListener('click', handleLogin);
    elements.regBtn.addEventListener('click', completeRegistration);
    elements.regName.addEventListener('input', () => elements.regBtn.disabled = !elements.regName.value);
    elements.clearCartBtn.addEventListener('click', () => { state.cart = []; updateCartUI(); });
    elements.checkoutBtn.addEventListener('click', openPayment);
    elements.cancelCustomBtn.addEventListener('click', () => elements.customModal.classList.add('hidden'));
    elements.confirmCustomBtn.addEventListener('click', finalizeAddToCart);

    // ADMIN EVENTS
    // 1. Acceso desde Login (ID: app-title-login)
    const loginTitle = document.getElementById('app-title-login');
    if(loginTitle) loginTitle.addEventListener('click', handleSecretClick);

    // 2. Acceso desde Kiosco (ID: app-title-kiosk) - NUEVO
    const kioskTitle = document.getElementById('app-title-kiosk');
    if(kioskTitle) kioskTitle.addEventListener('click', handleSecretClick);

    // Botones Admin
    document.getElementById('add-item-button').addEventListener('click', () => openEditModal('new'));
    document.getElementById('save-admin-button').addEventListener('click', closeAdmin);
    
    // Buscador
    if(elements.adminSearch) {
        elements.adminSearch.addEventListener('input', (e) => {
            state.adminSearchTerm = e.target.value.toLowerCase();
            renderAdminList();
        });
    }

    // Modal
    elements.cancelEditBtn.addEventListener('click', () => elements.editModal.classList.add('hidden'));
    elements.addModifierGroupBtn.addEventListener('click', () => addModifierGroupDOM());
    elements.saveItemBtn.addEventListener('click', saveItemChanges);
    elements.deleteItemBtn.addEventListener('click', deleteItem);
    
    // Carga Rápida
    if(elements.quickAddSelect) {
        elements.quickAddSelect.addEventListener('change', (e) => {
            const idx = e.target.value;
            if(idx !== "") {
                const template = JSON.parse(JSON.stringify(state.catalogs.modifierTemplates[idx]));
                addModifierGroupDOM(template);
                e.target.value = ""; 
            }
        });
    }
}

// --- LÓGICA DE ACCESO SECRETO (5 CLICS) ---
let clicks = 0;
function handleSecretClick() {
    clicks++;
    console.log("Click admin:", clicks);
    if(clicks === 5) {
        openAdmin();
        clicks = 0;
    }
}

// --- TIMEOUT ---
let inactivityTimer;
function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (elements.phoneScreen.classList.contains('hidden')) resetApp();
    }, 120000); 
}
window.onclick = window.onmousemove = window.onkeypress = window.ontouchstart = resetTimer;

// --- FLUJO USUARIO ---
function handleLogin() {
    state.currentPhone = elements.phoneInput.value;
    const users = JSON.parse(localStorage.getItem('dolce_mia_users') || '{}');
    if (users[state.currentPhone]) {
        state.currentUser = users[state.currentPhone];
        startApp();
    } else {
        elements.regModal.classList.remove('hidden');
    }
}

function completeRegistration() {
    const user = { name: elements.regName.value, phone: state.currentPhone };
    const users = JSON.parse(localStorage.getItem('dolce_mia_users') || '{}');
    users[state.currentPhone] = user;
    localStorage.setItem('dolce_mia_users', JSON.stringify(users));
    state.currentUser = user;
    elements.regModal.classList.add('hidden');
    startApp();
}

function startApp() {
    elements.phoneScreen.classList.add('hidden');
    elements.kioskApp.classList.remove('hidden');
    elements.kioskApp.classList.add('grid');
    elements.clientNameDisplay.textContent = state.currentUser.name;
    renderCategories();
    renderMenu('Todos');
}

// --- RENDER MENÚ ---
function renderCategories() {
    elements.categoryBar.innerHTML = '';
    const cats = ['Todos', ...new Set(state.menu.map(i => i.category))];
    state.categories = cats;
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat;
        btn.className = "px-6 py-2 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition whitespace-nowrap shadow-sm";
        btn.onclick = (e) => {
            Array.from(elements.categoryBar.children).forEach(b => { b.classList.replace('bg-red-600','bg-gray-200'); b.classList.replace('text-white','text-gray-700'); });
            e.target.classList.replace('bg-gray-200','bg-red-600'); e.target.classList.replace('text-gray-700','text-white');
            renderMenu(cat);
        };
        elements.categoryBar.appendChild(btn);
    });
}

function renderMenu(filter) {
    elements.menuContainer.innerHTML = '';
    const items = filter === 'Todos' ? state.menu : state.menu.filter(i => i.category === filter);
    const outOfStockList = JSON.parse(localStorage.getItem('dolce_mia_86') || '[]');

    items.forEach(item => {
        const isSoldOut = outOfStockList.includes(item.name);
        const card = document.createElement('div');
        card.className = `bg-white border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-200 ${isSoldOut ? 'opacity-60 grayscale' : 'hover:shadow-md'}`;
        
        let tagsHtml = '';
        if(item.tags && !isSoldOut) {
            tagsHtml = '<div class="flex flex-wrap gap-1 mt-2 mb-2">';
            item.tags.forEach(tag => {
                let colorClass = tag.includes("Chef") ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600";
                tagsHtml += `<span class="text-[10px] uppercase font-bold px-2 py-1 rounded-full ${colorClass}">${tag}</span>`;
            });
            tagsHtml += '</div>';
        }

        const btnText = isSoldOut ? "AGOTADO" : "Agregar";
        const btnClass = isSoldOut ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white";

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg leading-tight text-gray-800">${item.name}</h3>
                    <span class="text-red-600 font-bold ml-2 text-lg">$${item.price.toFixed(2)}</span>
                </div>
                ${tagsHtml}
                <p class="text-sm text-gray-500 mt-2 line-clamp-3">${item.description || ''}</p>
                ${item.modifiers && item.modifiers.length > 0 && !isSoldOut ? '<div class="mt-3 text-xs font-semibold text-blue-600">✨ Personalizable</div>' : ''}
            </div>
            <button class="mt-4 w-full py-3 font-bold rounded-lg transition duration-200 shadow-sm ${btnClass}" ${isSoldOut ? 'disabled' : ''}>
                ${btnText}
            </button>
        `;
        if(!isSoldOut) card.querySelector('button').onclick = () => prepareAddToCart(item);
        elements.menuContainer.appendChild(card);
    });
    
    elements.menuContainer.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-20 content-start";
}

// --- CARRITO & PERSONALIZACIÓN ---
function prepareAddToCart(item) {
    if (item.modifiers && item.modifiers.length > 0) {
        openCustomizationModal(item);
    } else {
        addToCart({ ...item, selectedModifiers: [], finalPrice: item.price });
    }
}

function openCustomizationModal(item) {
    state.tempCustomItem = JSON.parse(JSON.stringify(item));
    state.tempCustomItem.selectedModifiers = [];
    document.getElementById('custom-item-name').textContent = item.name;
    document.getElementById('custom-base-price').textContent = `$${item.price.toFixed(2)}`;
    elements.customContent.innerHTML = '';
    
    item.modifiers.forEach((group, gIndex) => {
        const div = document.createElement('div');
        div.className = "bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4";
        div.innerHTML = `<h4 class="font-bold mb-3 text-lg">${group.name}</h4>`;
        group.options.forEach((opt, oIndex) => {
            const row = document.createElement('label');
            row.className = "flex justify-between py-3 px-3 cursor-pointer bg-white mb-2 rounded-lg border hover:border-red-300 shadow-sm";
            row.innerHTML = `
                <div class="flex items-center"><input type="checkbox" class="w-5 h-5 text-red-600 rounded" data-group="${gIndex}" data-option="${oIndex}" onchange="updateCustomTotal()"> <span class="ml-3 font-medium">${opt.name}</span></div>
                <span class="${opt.price > 0 ? 'text-red-600 font-bold' : 'text-green-600 text-xs font-bold uppercase'}">${opt.price > 0 ? '+$'+opt.price : 'Incluido'}</span>
            `;
            div.appendChild(row);
        });
        elements.customContent.appendChild(div);
    });
    updateCustomTotal();
    elements.customModal.classList.remove('hidden');
}

window.updateCustomTotal = () => {
    let total = state.tempCustomItem.price;
    const selected = [];
    elements.customContent.querySelectorAll('input:checked').forEach(cb => {
        const opt = state.tempCustomItem.modifiers[cb.dataset.group].options[cb.dataset.option];
        total += opt.price;
        selected.push(opt);
    });
    elements.customTotal.textContent = `$${total.toFixed(2)}`;
    state.tempCustomItem.currentTotal = total;
    state.tempCustomItem.tempSelected = selected;
};

function finalizeAddToCart() {
    const item = { ...state.tempCustomItem, finalPrice: state.tempCustomItem.currentTotal || state.tempCustomItem.price, selectedModifiers: state.tempCustomItem.tempSelected || [], cartId: Date.now() + Math.random() };
    addToCart(item);
    elements.customModal.classList.add('hidden');
}

function addToCart(item) {
    let existing;
    if (item.selectedModifiers.length === 0) existing = state.cart.find(i => i.id === item.id && i.selectedModifiers.length === 0);
    if (existing) existing.qty++; else state.cart.push({ ...item, qty: 1 });
    updateCartUI();
}

function updateCartUI() {
    elements.cartList.innerHTML = '';
    let subtotal = 0;
    if(state.cart.length === 0) {
        elements.emptyCartMsg.classList.remove('hidden');
        elements.checkoutBtn.disabled = true;
        elements.clearCartBtn.disabled = true;
        elements.subtotalDisplay.textContent = "$0.00";
    } else {
        elements.emptyCartMsg.classList.add('hidden');
        elements.checkoutBtn.disabled = false;
        elements.clearCartBtn.disabled = false;
        state.cart.forEach((item, index) => {
            subtotal += item.finalPrice * item.qty;
            const div = document.createElement('div');
            div.className = "flex justify-between items-start bg-gray-800 p-4 rounded-xl mb-3 border border-gray-700 shadow-md";
            const modsHtml = item.selectedModifiers.map(m => `<span class="text-xs text-blue-300 block">• ${m.name}</span>`).join('');
            div.innerHTML = `
                <div class="flex-1 pr-2"><div class="font-bold text-white text-lg">${item.name}</div><div class="pl-2 border-l-2 border-gray-600 mt-1 mb-2">${modsHtml}</div><div class="text-sm text-gray-400 font-mono">$${item.finalPrice.toFixed(2)} x ${item.qty}</div></div>
                <div class="flex items-center gap-3 bg-gray-700 p-1 rounded-full"><button class="w-8 h-8 rounded-full bg-gray-600 text-white font-bold hover:bg-gray-500" onclick="modQty(${index}, -1)">-</button><span class="font-bold w-4 text-center text-white">${item.qty}</span><button class="w-8 h-8 rounded-full bg-white text-gray-900 font-bold" onclick="modQty(${index}, 1)">+</button></div>
            `;
            elements.cartList.appendChild(div);
        });
        const tax = subtotal * state.taxRate;
        elements.subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
        elements.taxDisplay.textContent = `$${tax.toFixed(2)}`;
        elements.totalDisplay.textContent = `$${(subtotal + tax).toFixed(2)}`;
    }
}

window.modQty = (index, change) => {
    state.cart[index].qty += change;
    if (state.cart[index].qty <= 0) state.cart.splice(index, 1);
    updateCartUI();
};

function openPayment() { elements.paymentModal.classList.remove('hidden'); elements.paymentUi.classList.remove('hidden'); elements.paymentSuccess.classList.add('hidden'); elements.paymentTotal.textContent = elements.totalDisplay.textContent; }
window.closePayment = () => elements.paymentModal.classList.add('hidden');

window.processPayment = () => {
    elements.paymentUi.innerHTML = '<div class="p-10 text-center"><div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-red-600 mx-auto mb-4"></div><p>Enviando...</p></div>';
    setTimeout(() => {
        const orderId = Math.floor(Math.random() * 1000) + 1000;
        const newOrder = {
            id: orderId,
            client: state.currentUser ? state.currentUser.name : "Invitado",
            items: [...state.cart],
            total: elements.totalDisplay.textContent,
            status: 'pending', status_cocina: 'pending', status_barra: 'pending', paymentStatus: 'pending',
            startTime: new Date().getTime(),
            timeString: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        const currentOrders = JSON.parse(localStorage.getItem('dolce_mia_orders') || '[]');
        currentOrders.push(newOrder);
        localStorage.setItem('dolce_mia_orders', JSON.stringify(currentOrders));
        elements.paymentUi.classList.add('hidden');
        elements.paymentSuccess.classList.remove('hidden');
        document.getElementById('order-number').textContent = orderId;
        state.cart = []; updateCartUI();
    }, 1500);
};

window.resetApp = () => location.reload();

// --- ADMIN DASHBOARD ---
function openAdmin() {
    elements.adminScreen.classList.remove('hidden');
    state.adminFilterCategory = 'Todos';
    state.adminSearchTerm = '';
    if(elements.adminSearch) elements.adminSearch.value = '';
    renderAdminSidebar(); renderAdminList(); updateAdminStats();
}
function closeAdmin() { elements.adminScreen.classList.add('hidden'); renderCategories(); renderMenu('Todos'); }

function renderAdminSidebar() {
    const sidebar = document.getElementById('admin-category-sidebar');
    if(!sidebar) return;
    sidebar.innerHTML = '';
    const cats = [...new Set(state.menu.map(i => i.category))].sort();
    cats.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = state.adminFilterCategory === cat;
        const count = state.menu.filter(i => i.category === cat).length;
        btn.className = `w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition flex justify-between items-center ${isActive ? 'bg-white border-2 border-red-100 text-red-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`;
        btn.innerHTML = `<span>${cat}</span> <span class="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">${count}</span>`;
        btn.onclick = () => { state.adminFilterCategory = cat; renderAdminSidebar(); renderAdminList(); };
        sidebar.appendChild(btn);
    });
}

window.filterAdminCategory = (cat) => { state.adminFilterCategory = cat; renderAdminSidebar(); renderAdminList(); };

function updateAdminStats() {
    const totalItems = state.menu.length;
    const totalCats = [...new Set(state.menu.map(i => i.category))].length;
    if(elements.statTotalItems) elements.statTotalItems.textContent = totalItems;
    if(elements.statTotalCats) elements.statTotalCats.textContent = totalCats;
}

function renderAdminList() {
    const listContainer = elements.adminMenuList;
    listContainer.innerHTML = '';
    const titleEl = document.getElementById('admin-current-view');
    if(titleEl) titleEl.textContent = state.adminFilterCategory === 'Todos' ? 'Todos los Platillos' : state.adminFilterCategory;
    let items = state.menu;
    if (state.adminFilterCategory !== 'Todos') items = items.filter(i => i.category === state.adminFilterCategory);
    if (state.adminSearchTerm) items = items.filter(i => i.name.toLowerCase().includes(state.adminSearchTerm));
    if(document.getElementById('admin-showing-count')) document.getElementById('admin-showing-count').textContent = `Mostrando ${items.length} resultados`;

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "bg-white p-0 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group overflow-hidden flex flex-col";
        let tagBadge = '';
        if(item.tags && item.tags.length > 0) tagBadge = `<span class="absolute top-3 right-3 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-1 rounded-full font-bold uppercase z-10">${item.tags[0]}</span>`;
        div.innerHTML = `
            <div class="p-5 flex-grow relative">${tagBadge}<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">${item.category}</div><h3 class="font-bold text-gray-800 text-lg mb-1 leading-tight">${item.name}</h3><p class="text-2xl font-extrabold text-red-600">$${item.price.toFixed(2)}</p><p class="text-sm text-gray-500 mt-3 line-clamp-2">${item.description || 'Sin descripción'}</p>${item.modifiers && item.modifiers.length > 0 ? `<div class="mt-3 inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-medium"><span>🛠️</span> ${item.modifiers.length} Opciones</div>` : ''}</div>
            <div class="bg-gray-50 border-t border-gray-100 p-3 flex gap-2"><button onclick="openEditModal(${item.id})" class="flex-1 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition shadow-sm">✏️ Editar</button><button onclick="confirmDelete(${item.id})" class="w-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition shadow-sm">🗑️</button></div>
        `;
        listContainer.appendChild(div);
    });
}

// Wrapper globales
window.confirmDelete = (id) => { state.editingItemId = id; deleteItem(); };
window.openEditModal = (id) => openEditModal(id);

function openEditModal(id) {
    elements.editModal.classList.remove('hidden');
    // Chips
    if(elements.categoryChips) {
        elements.categoryChips.innerHTML = '';
        const cats = ['Entradas', 'Pastas', 'Pizzas', 'Bebidas', 'Postres', 'Ensaladas'];
        state.menu.forEach(i => { if(!cats.includes(i.category)) cats.push(i.category); });
        cats.forEach(cat => {
            const chip = document.createElement('div');
            chip.className = "px-3 py-1 bg-gray-200 rounded-full text-xs font-bold text-gray-600 cursor-pointer hover:bg-red-100 hover:text-red-600 transition";
            chip.textContent = cat;
            chip.onclick = () => { elements.editCategory.value = cat; Array.from(elements.categoryChips.children).forEach(c => { c.classList.remove('bg-red-500', 'text-white'); c.classList.add('bg-gray-200', 'text-gray-600'); }); chip.classList.remove('bg-gray-200', 'text-gray-600'); chip.classList.add('bg-red-500', 'text-white'); };
            elements.categoryChips.appendChild(chip);
        });
    }
    // Dropdown
    if(elements.quickAddSelect) {
        elements.quickAddSelect.innerHTML = '<option value="">⚡ Carga Rápida...</option>';
        state.catalogs.modifierTemplates.forEach((tpl, index) => {
            const opt = document.createElement('option');
            opt.value = index; opt.textContent = `+ ${tpl.name}`; elements.quickAddSelect.appendChild(opt);
        });
    }
    document.querySelectorAll('.edit-tag-checkbox').forEach(cb => cb.checked = false);

    if (id === 'new') {
        state.editingItemId = null;
        elements.editName.value = ''; elements.editPrice.value = ''; elements.editCategory.value = ''; elements.editDesc.value = '';
        renderModifiersDOM([]);
    } else {
        const item = state.menu.find(i => i.id === id);
        state.editingItemId = id;
        elements.editName.value = item.name; elements.editPrice.value = item.price; elements.editCategory.value = item.category; elements.editDesc.value = item.description || '';
        if(item.tags) document.querySelectorAll('.edit-tag-checkbox').forEach(cb => { if(item.tags.includes(cb.value)) cb.checked = true; });
        renderModifiersDOM(item.modifiers || []);
    }
}

function renderModifiersDOM(modifiers) {
    elements.editModifiersContainer.innerHTML = '';
    if(!modifiers || modifiers.length === 0) { elements.editModifiersContainer.innerHTML = '<p class="text-gray-400 text-center italic mt-10">Sin opciones.</p>'; return; }
    modifiers.forEach(group => addModifierGroupDOM(group));
}

function addModifierGroupDOM(groupData = null) {
    if(elements.editModifiersContainer.querySelector('p')) elements.editModifiersContainer.innerHTML = '';
    const div = document.createElement('div');
    div.className = "modifier-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative";
    const name = groupData ? groupData.name : '';
    div.innerHTML = `
        <div class="absolute top-2 right-2"><button class="text-gray-400 hover:text-red-500 transition remove-group p-1">✕</button></div>
        <div class="mb-3"><input type="text" placeholder="Grupo (Ej: Salsas)" value="${name}" class="mod-group-name w-full font-bold text-gray-800 border-b-2 border-gray-200 focus:border-blue-500 outline-none pb-1 bg-transparent"></div>
        <div class="options-container space-y-2"></div>
        <button class="w-full mt-3 py-1 bg-gray-50 text-blue-600 font-bold text-xs rounded border border-dashed border-gray-300 hover:bg-blue-50 transition add-option">+ Agregar Opción</button>
    `;
    div.querySelector('.remove-group').onclick = () => div.remove();
    const optContainer = div.querySelector('.options-container');
    div.querySelector('.add-option').onclick = () => addOptionDOM(optContainer);
    if(groupData && groupData.options) groupData.options.forEach(opt => addOptionDOM(optContainer, opt)); else addOptionDOM(optContainer);
    elements.editModifiersContainer.appendChild(div);
}

function addOptionDOM(container, optData = null) {
    const div = document.createElement('div');
    div.className = "modifier-option flex gap-2 items-center";
    const name = optData ? optData.name : '';
    const price = optData ? optData.price : '';
    div.innerHTML = `<input type="text" placeholder="Opción" value="${name}" class="mod-opt-name flex-grow p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none"><input type="number" placeholder="$" value="${price}" class="mod-opt-price w-20 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none"><button class="text-gray-300 hover:text-red-500 remove-opt text-lg">×</button>`;
    div.querySelector('.remove-opt').onclick = () => div.remove();
    container.appendChild(div);
}

function saveItemChanges() {
    const name = elements.editName.value.trim();
    const price = parseFloat(elements.editPrice.value);
    const category = elements.editCategory.value.trim();
    const desc = elements.editDesc.value.trim();
    if (!name || isNaN(price) || !category) return alert("Faltan datos.");

    const tags = [];
    document.querySelectorAll('.edit-tag-checkbox:checked').forEach(cb => tags.push(cb.value));

    const modifiers = [];
    document.querySelectorAll('.modifier-group').forEach(grp => {
        const gName = grp.querySelector('.mod-group-name').value.trim();
        if(!gName) return;
        const options = [];
        grp.querySelectorAll('.modifier-option').forEach(opt => {
            const oName = opt.querySelector('.mod-opt-name').value.trim();
            const oPrice = parseFloat(opt.querySelector('.mod-opt-price').value) || 0;
            if(oName) options.push({name: oName, price: oPrice});
        });
        if(options.length) modifiers.push({name: gName, options});
    });

    const newItem = { id: state.editingItemId || Date.now(), name, price, category, description: desc, modifiers, tags };
    if (state.editingItemId) {
        const idx = state.menu.findIndex(i => i.id === state.editingItemId);
        state.menu[idx] = newItem;
    } else {
        state.menu.push(newItem);
    }
    saveMenu();
    elements.editModal.classList.add('hidden');
    renderAdminList();
    updateAdminStats();
}

function deleteItem() {
    if(confirm("¿Eliminar?")) {
        state.menu = state.menu.filter(i => i.id !== state.editingItemId);
        saveMenu();
        elements.editModal.classList.add('hidden');
        renderAdminList();
        updateAdminStats();
    }
}
