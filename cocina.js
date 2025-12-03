// --- LÓGICA KDS PRO (Flujos Independientes) ---

let ordersData = [];
let currentFilter = 'all'; // 'all', 'cocina', 'barra'
let soundEnabled = false;
let audioCtx = null;

const SLA_WARNING = 10;
const SLA_DANGER = 20;

// INICIALIZACIÓN
function initSystem() {
    document.getElementById('start-overlay').classList.add('hidden');
    soundEnabled = true;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    updateClock();
    setInterval(updateClock, 1000);
    loadOrders();
    setInterval(loadOrders, 2000);
    renderAllDay();
    
    // Iniciar en filtro 'all' visualmente
    setStationFilter('all');
}

// 1. CARGA DE DATOS
function loadOrders() {
    const raw = localStorage.getItem('dolce_mia_orders');
    let newData = raw ? JSON.parse(raw) : [];
    
    // MIGRACIÓN DE DATOS ANTIGUOS (Si existen órdenes viejas sin los nuevos campos)
    newData = newData.map(o => {
        if (!o.status_cocina) o.status_cocina = o.status;
        if (!o.status_barra) o.status_barra = o.status;
        return o;
    });

    const oldPendingCount = ordersData.filter(o => o.status === 'pending').length;
    const newPendingCount = newData.filter(o => o.status === 'pending').length;

    if (soundEnabled && newPendingCount > oldPendingCount) {
        playNotificationSound();
    }

    if (JSON.stringify(newData) !== JSON.stringify(ordersData)) {
        ordersData = newData;
        renderBoard();
        renderAllDay();
    } else {
        updateTimes();
    }
}

function playNotificationSound() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(600, audioCtx.currentTime);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    o.start();
    o.stop(audioCtx.currentTime + 0.6);
}

// 3. FILTRO DE ESTACIÓN
function setStationFilter(station) {
    currentFilter = station;
    
    ['all', 'cocina', 'barra'].forEach(s => {
        const btn = document.getElementById(`btn-station-${s}`);
        if(s === station) {
            btn.classList.remove('text-slate-400', 'bg-transparent');
            btn.classList.add('bg-slate-600', 'text-white');
        } else {
            btn.classList.add('text-slate-400', 'bg-transparent');
            btn.classList.remove('bg-slate-600', 'text-white');
        }
    });
    
    renderBoard();
}

// Ayudante para saber si un item pertenece a la vista actual
function shouldShowItem(itemCategory) {
    const isBar = itemCategory.includes('Bebidas') || itemCategory.includes('Mixología') || itemCategory.includes('Frappés');
    
    if (currentFilter === 'all') return true; 
    if (currentFilter === 'barra' && isBar) return true;
    if (currentFilter === 'cocina' && !isBar) return true;
    
    return false;
}

// 4. RENDERIZADO DEL KANBAN (Lógica de Flujos Separados)
function renderBoard() {
    const cols = {
        pending: document.getElementById('col-pending'),
        cooking: document.getElementById('col-cooking'),
        ready: document.getElementById('col-ready')
    };

    Object.values(cols).forEach(col => col.innerHTML = '');

    let counts = { pending: 0, cooking: 0, ready: 0 };

    ordersData.forEach(order => {
        // 1. Determinar qué estado usar según el filtro activo
        let activeStatus = order.status; // Por defecto (ALL)
        
        if (currentFilter === 'cocina') activeStatus = order.status_cocina;
        if (currentFilter === 'barra') activeStatus = order.status_barra;

        if (activeStatus === 'archived') return;

        // 2. Verificar si la orden tiene items para esta estación
        const hasItems = order.items.some(i => shouldShowItem(i.category));
        if (!hasItems) return; // Si soy Barra y la orden es pura Comida, no la muestro

        counts[activeStatus]++;
        const card = createOrderCard(order, activeStatus);
        
        if (cols[activeStatus]) cols[activeStatus].appendChild(card);
    });

    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-cooking').textContent = counts.cooking;
    document.getElementById('count-ready').textContent = counts.ready;
}

function createOrderCard(order, statusToShow) {
    const div = document.createElement('div');
    
    // SLA Visual
    const minutesAgo = Math.floor((new Date().getTime() - order.startTime) / 60000);
    let slaClass = 'border-slate-600';
    let timeClass = 'bg-slate-700 text-slate-300';
    
    if (statusToShow !== 'ready') {
        if (minutesAgo >= SLA_DANGER) {
            slaClass = 'delayed-order border-red-500';
            timeClass = 'bg-red-600 text-white font-bold';
        } else if (minutesAgo >= SLA_WARNING) {
            slaClass = 'border-yellow-500';
            timeClass = 'bg-yellow-600 text-black font-bold';
        }
    }

    // --- LÓGICA DE BOTONES INDEPENDIENTE ---
    let actions = '';
    
    // Función wrapper para pasar el filtro actual al updateStatus
    const nextStep = (nextStatus) => `updateStatus(${order.id}, '${nextStatus}')`;

    if (statusToShow === 'pending') {
        actions = `<button onclick="${nextStep('cooking')}" class="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition">🔥 Preparar</button>`;
    } else if (statusToShow === 'cooking') {
        actions = `<button onclick="${nextStep('ready')}" class="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded shadow transition">✅ Terminar</button>`;
    } else {
        actions = `<button onclick="${nextStep('archived')}" class="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded shadow transition">📦 Archivar</button>`;
    }

    // Si estamos en 'ALL', los botones controlan el estado GLOBAL (afecta a todos)
    // Si estamos en 'COCINA', solo afecta a Cocina.
    const stationLabel = currentFilter === 'all' ? 'GLOBAL' : currentFilter.toUpperCase();

    div.className = `bg-slate-800 text-white p-0 rounded-lg shadow-lg border-l-4 ${slaClass} flex flex-col mb-3 animate-slide-in`;
    
    // Renderizado de Items
    const itemsList = order.items.map((item, idx) => ({ ...item, originalIndex: idx }));
    const entradas = itemsList.filter(i => shouldShowItem(i.category) && i.category.includes('Entradas'));
    const principales = itemsList.filter(i => shouldShowItem(i.category) && !i.category.includes('Entradas'));

    let itemsHtml = '';
    const renderRow = (i) => renderItemRow(order.id, i, i.originalIndex);

    if (entradas.length > 0) {
        itemsHtml += `<div class="bg-orange-900/30 px-3 py-1 text-[10px] font-bold text-orange-300 uppercase tracking-widest">Primer Tiempo</div>`;
        itemsHtml += entradas.map(renderRow).join('');
    }
    if (principales.length > 0) {
        if(entradas.length > 0) itemsHtml += `<div class="bg-blue-900/30 px-3 py-1 text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">Segundo Tiempo</div>`;
        itemsHtml += principales.map(renderRow).join('');
    }

    div.innerHTML = `
        <div class="flex justify-between items-start p-3 bg-slate-800 border-b border-slate-700">
            <div>
                <span class="text-xl font-black text-white">#${order.id}</span>
                <div class="text-xs text-slate-400 uppercase font-bold truncate max-w-[120px] mt-0.5">👤 ${order.client}</div>
            </div>
            <div class="text-right">
                <div class="text-xs font-mono text-slate-500">${order.timeString}</div>
                <div class="${timeClass} px-2 py-0.5 rounded text-xs mt-1 inline-block shadow-sm" id="timer-${order.id}">${minutesAgo} min</div>
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto max-h-[350px] bg-slate-800/50">
            ${itemsHtml}
        </div>

        <div class="p-2 border-t border-slate-700 flex gap-2 bg-slate-800">
            <div class="text-[10px] text-gray-500 absolute bottom-1 right-2">${stationLabel}</div>
            ${actions}
        </div>
    `;
    return div;
}

function renderItemRow(orderId, item, index) {
    const isCompleted = item.completed === true;
    // Estilos visuales para item completado
    const opacityClass = isCompleted ? 'opacity-40' : 'opacity-100';
    const strikeClass = isCompleted ? 'line-through text-slate-500' : 'text-slate-200';
    const icon = isCompleted ? '✅' : '⬜';
    const bgHover = 'hover:bg-slate-700';

    const mods = item.selectedModifiers ? item.selectedModifiers.map(m => `<span class="text-blue-300 text-xs ml-1 block">[${m.name}]</span>`).join('') : '';
    
    return `
        <div class="flex justify-between items-start py-2 px-3 border-b border-slate-700/50 cursor-pointer ${bgHover} transition select-none ${opacityClass}" 
             onclick="toggleItemCompletion(${orderId}, ${index})">
            <div class="flex items-start gap-2">
                <span class="text-xs mt-1">${icon}</span>
                <div class="leading-tight ${strikeClass}">
                    <span class="font-bold text-lg mr-1">${item.qty}</span> 
                    <span class="font-medium">${item.name}</span>
                    ${mods}
                </div>
            </div>
            <button onclick="event.stopPropagation(); open86Modal('${item.name}')" class="text-xs text-slate-600 hover:text-red-500 p-1">🚫</button>
        </div>
    `;
}

// --- ACTUALIZACIÓN DE ESTADOS (CORE) ---
window.updateStatus = (id, newStatus) => {
    const idx = ordersData.findIndex(o => o.id === id);
    if(idx !== -1) {
        // Lógica de estaciones (igual que antes)
        if (currentFilter === 'cocina') ordersData[idx].status_cocina = newStatus;
        else if (currentFilter === 'barra') ordersData[idx].status_barra = newStatus;
        else {
            ordersData[idx].status = newStatus;
            ordersData[idx].status_cocina = newStatus;
            ordersData[idx].status_barra = newStatus;
        }

        // --- NUEVO: GUARDAR TIEMPO DE FINALIZACIÓN ---
        // Si la orden pasa a 'ready' o 'archived' y no tiene tiempo final, lo guardamos.
        if ((newStatus === 'ready' || newStatus === 'archived') && !ordersData[idx].endTime) {
            ordersData[idx].endTime = new Date().getTime();
            
            // Calcular duración final en minutos
            const duration = (ordersData[idx].endTime - ordersData[idx].startTime) / 60000;
            ordersData[idx].durationMinutes = duration;
        }
        // ---------------------------------------------

        // Sincronizar estado global
        if (ordersData[idx].status_cocina === 'archived' && ordersData[idx].status_barra === 'archived') {
            ordersData[idx].status = 'archived';
        }

        localStorage.setItem('dolce_mia_orders', JSON.stringify(ordersData));
        renderBoard();
        renderAllDay();
    }
};

window.toggleItemCompletion = (orderId, itemIndex) => {
    const orderIdx = ordersData.findIndex(o => o.id === orderId);
    if (orderIdx !== -1) {
        if (ordersData[orderIdx].items[itemIndex].completed === undefined) {
            ordersData[orderIdx].items[itemIndex].completed = false;
        }
        ordersData[orderIdx].items[itemIndex].completed = !ordersData[orderIdx].items[itemIndex].completed;
        localStorage.setItem('dolce_mia_orders', JSON.stringify(ordersData));
        renderBoard();
    }
};

// ... (Resto de funciones utilitarias: RenderAllDay, Historial, 86, Clock, etc. se mantienen igual) ...
// (Copia las funciones de utilidad del código anterior aquí abajo, no cambian)

function renderAllDay() {
    const list = document.getElementById('all-day-list');
    const totalEl = document.getElementById('total-pending-items');
    if (!list) return;

    const aggregator = {};
    let totalCount = 0;

    ordersData.forEach(order => {
        // En All-Day solo contamos lo que está activo GLOBALMENTE o en la estación activa
        let activeStatus = order.status;
        if(currentFilter === 'cocina') activeStatus = order.status_cocina;
        if(currentFilter === 'barra') activeStatus = order.status_barra;

        if (activeStatus === 'archived' || activeStatus === 'ready') return;
        
        order.items.forEach(item => {
            if (item.completed) return; 
            if (!shouldShowItem(item.category)) return;
            
            const key = item.name;
            if (!aggregator[key]) aggregator[key] = 0;
            aggregator[key] += item.qty;
            totalCount += item.qty;
        });
    });

    list.innerHTML = Object.entries(aggregator)
        .sort(([,a], [,b]) => b - a)
        .map(([name, qty]) => `
            <div class="flex justify-between items-center bg-slate-800 p-2 rounded border-l-2 border-blue-500 mb-1">
                <span class="text-sm text-slate-300 truncate w-32">${name}</span>
                <span class="font-bold text-white text-lg bg-slate-700 px-2 rounded min-w-[30px] text-center">${qty}</span>
            </div>
        `).join('');
        
    totalEl.textContent = totalCount;
}

function toggleAllDay() {
    const sidebar = document.getElementById('all-day-panel');
    sidebar.classList.toggle('-translate-x-full');
    sidebar.classList.toggle('lg:translate-x-0');
}

function openHistory() {
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');
    modal.classList.remove('hidden');
    const archived = ordersData.filter(o => o.status === 'archived').reverse().slice(0, 20);
    list.innerHTML = archived.map(order => `
        <div class="flex justify-between items-center bg-slate-700 p-3 rounded border border-slate-600">
            <div>
                <span class="font-bold text-lg text-white">#${order.id}</span>
                <span class="text-sm text-slate-400 ml-2">👤 ${order.client}</span>
            </div>
            <button onclick="undoOrder(${order.id})" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold shadow">↩️ Restaurar</button>
        </div>
    `).join('') || '<p class="text-center text-gray-500 mt-4">No hay historial reciente.</p>';
}

window.undoOrder = (id) => {
    updateStatus(id, 'ready'); 
    document.getElementById('history-modal').classList.add('hidden');
};

let itemTo86 = null;
window.open86Modal = (itemName) => {
    itemTo86 = itemName;
    document.getElementById('stock-item-name').textContent = itemName;
    document.getElementById('stock-modal').classList.remove('hidden');
};

document.getElementById('confirm-86-btn').addEventListener('click', () => {
    if(!itemTo86) return;
    const outOfStock = JSON.parse(localStorage.getItem('dolce_mia_86') || '[]');
    if(!outOfStock.includes(itemTo86)) {
        outOfStock.push(itemTo86);
        localStorage.setItem('dolce_mia_86', JSON.stringify(outOfStock));
        alert(`🚫 ${itemTo86} marcado como AGOTADO.`);
    }
    document.getElementById('stock-modal').classList.add('hidden');
});

window.clearAllData = () => {
    if(confirm('⚠️ ¿ESTÁS SEGURO? Se borrarán todas las comandas.')) {
        localStorage.removeItem('dolce_mia_orders');
        loadOrders();
    }
};

function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function updateTimes() {
    ordersData.forEach(order => {
        const el = document.getElementById(`timer-${order.id}`);
        if(el) {
            const mins = Math.floor((new Date().getTime() - order.startTime) / 60000);
            el.textContent = `${mins} min`;
            // Nota: Aquí solo revisamos el estado global para el color, 
            // pero podrías hacerlo específico por estación si quisieras hilar muy fino.
            if (order.status !== 'ready') {
                if (mins >= SLA_DANGER) {
                    el.className = 'bg-red-600 text-white font-bold px-2 py-0.5 rounded text-xs mt-1 inline-block';
                    el.closest('.border-l-4').classList.add('delayed-order', 'border-red-500');
                } else if (mins >= SLA_WARNING) {
                    el.className = 'bg-yellow-600 text-black font-bold px-2 py-0.5 rounded text-xs mt-1 inline-block';
                }
            }
        }
    });
}
