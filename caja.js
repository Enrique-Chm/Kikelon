// --- LÓGICA DE CAJA / POS (Dolce Mia) ---

let allOrders = [];
let selectedOrder = null;
let currentPaymentMethod = 'cash';
let inputBuffer = "";

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    setInterval(loadOrders, 5000); // Refrescar lista cada 5s
    document.getElementById('search-order').addEventListener('input', (e) => renderOrdersList(e.target.value));
});

function loadOrders() {
    const raw = localStorage.getItem('dolce_mia_orders');
    const newData = raw ? JSON.parse(raw) : [];
    if (JSON.stringify(newData) !== JSON.stringify(allOrders)) {
        allOrders = newData;
        renderOrdersList(document.getElementById('search-order').value);
    }
}

function renderOrdersList(searchTerm = "") {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';
    let filtered = allOrders.slice().reverse(); // Más recientes primero

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(o => o.id.toString().includes(term) || o.client.toLowerCase().includes(term));
    }

    filtered.forEach(order => {
        // Estado de Pago
        const isPaid = order.paymentStatus === 'paid';
        const statusClass = isPaid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-red-400';
        const badge = isPaid ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">PAGADO</span>' : '<span class="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">PENDIENTE</span>';

        const div = document.createElement('div');
        div.className = `p-3 border rounded-lg cursor-pointer shadow-sm transition ${statusClass}`;
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-gray-800">#${order.id}</span>
                ${badge}
            </div>
            <div class="flex justify-between items-end">
                <div><p class="text-sm font-semibold text-gray-600">${order.client}</p><p class="text-xs text-gray-400">${order.items.length} items • ${order.timeString}</p></div>
                <span class="font-mono font-bold text-lg text-slate-800">${order.total}</span>
            </div>
        `;
        div.onclick = () => selectOrder(order.id);
        container.appendChild(div);
    });
}

function selectOrder(id) {
    selectedOrder = allOrders.find(o => o.id === id);
    if (!selectedOrder) return;

    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('ticket-content').classList.remove('hidden');
    document.getElementById('payment-overlay').classList.add('hidden');

    document.getElementById('ticket-id').textContent = selectedOrder.id;
    document.getElementById('ticket-client').textContent = selectedOrder.client;
    document.getElementById('ticket-time').textContent = new Date(selectedOrder.startTime).toLocaleString();
    
    // Calcular totales
    const totalVal = parseFloat(selectedOrder.total.replace(/[$,]/g, ''));
    const subtotal = totalVal / 1.16;
    const tax = totalVal - subtotal;

    document.getElementById('ticket-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('ticket-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('ticket-total').textContent = selectedOrder.total;

    // Items
    const container = document.getElementById('ticket-items');
    container.innerHTML = '';
    selectedOrder.items.forEach(item => {
        const mods = item.selectedModifiers ? item.selectedModifiers.map(m => `<div class="text-xs text-gray-500 italic">+ ${m.name}</div>`).join('') : '';
        container.innerHTML += `
            <div class="flex justify-between items-start border-b border-gray-100 pb-2 text-sm">
                <div><span class="font-bold">${item.qty}</span> ${item.name} ${mods}</div>
                <div class="font-mono">$${item.finalPrice.toFixed(2)}</div>
            </div>`;
    });

    // Estado del botón
    const payBtn = document.getElementById('btn-process-payment');
    if(selectedOrder.paymentStatus === 'paid') {
        payBtn.textContent = "✅ TICKET PAGADO";
        payBtn.className = "w-full py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-default";
        payBtn.disabled = true;
        // Mostrar botón de imprimir directo
        // (Opcional: Podrías añadir un botón de "Reimprimir" aquí)
    } else {
        payBtn.textContent = "COBRAR TICKET";
        payBtn.className = "w-full py-4 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-xl shadow-lg transition";
        payBtn.disabled = false;
    }
}

// Calculadora
function setPaymentMethod(m) {
    currentPaymentMethod = m;
    const cash = document.getElementById('btn-cash');
    const card = document.getElementById('btn-card');
    const pCash = document.getElementById('cash-panel');
    const pCard = document.getElementById('card-panel');

    if(m === 'cash') {
        cash.classList.replace('border-slate-600', 'border-green-500'); cash.classList.add('bg-green-500/20', 'text-green-400');
        card.classList.replace('border-blue-500', 'border-slate-600'); card.classList.remove('bg-blue-500/20', 'text-blue-400');
        pCash.classList.remove('hidden'); pCard.classList.add('hidden');
    } else {
        card.classList.replace('border-slate-600', 'border-blue-500'); card.classList.add('bg-blue-500/20', 'text-blue-400');
        cash.classList.replace('border-green-500', 'border-slate-600'); cash.classList.remove('bg-green-500/20', 'text-green-400');
        pCash.classList.add('hidden'); pCard.classList.remove('hidden');
    }
}

function addNum(n) { if(selectedOrder?.paymentStatus === 'paid') return; inputBuffer += n; updateCalc(); }
function clearNum() { inputBuffer = ""; updateCalc(); }
function updateCalc() {
    document.getElementById('amount-received').value = inputBuffer;
    const total = parseFloat(selectedOrder.total.replace(/[$,]/g, ''));
    const recv = parseFloat(inputBuffer) || 0;
    const change = recv - total;
    const disp = document.getElementById('change-display');
    
    if(recv >= total) {
        disp.textContent = `$${change.toFixed(2)}`;
        disp.className = "text-3xl font-mono text-green-400 font-bold";
    } else {
        disp.textContent = "Faltan $" + Math.abs(change).toFixed(2);
        disp.className = "text-xl font-mono text-red-400 font-bold";
    }
}

function processTransaction() {
    if(currentPaymentMethod === 'card') {
        const btn = document.getElementById('btn-process-payment');
        btn.textContent = "Procesando...";
        setTimeout(finalizeOrder, 1500);
    } else {
        const total = parseFloat(selectedOrder.total.replace(/[$,]/g, ''));
        const recv = parseFloat(inputBuffer) || 0;
        if(recv < total) return alert("Monto insuficiente");
        finalizeOrder();
    }
}

function finalizeOrder() {
    const idx = allOrders.findIndex(o => o.id === selectedOrder.id);
    if(idx !== -1) {
        allOrders[idx].paymentStatus = 'paid';
        allOrders[idx].paymentMethod = currentPaymentMethod;
        localStorage.setItem('dolce_mia_orders', JSON.stringify(allOrders));
        document.getElementById('success-modal').classList.remove('hidden');
        renderOrdersList();
    }
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
    selectOrder(selectedOrder.id); // Refrescar vista
}

// --- IMPRESIÓN DE TICKET TÉRMICO ---
window.printTicket = () => {
    if (!selectedOrder) return;

    const itemsRows = selectedOrder.items.map(item => `
        <tr>
            <td style="padding: 5px 0;">${item.qty} ${item.name}</td>
            <td style="text-align: right;">$${item.finalPrice.toFixed(2)}</td>
        </tr>
        ${item.selectedModifiers ? item.selectedModifiers.map(m => `
            <tr><td colspan="2" style="font-size: 10px; color: #666; padding-left: 10px;">+ ${m.name}</td></tr>
        `).join('') : ''}
    `).join('');

    const ticketHTML = `
        <html>
        <head>
            <title>Ticket #${selectedOrder.id}</title>
            <style>
                body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 10px; font-size: 12px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                .total { font-size: 16px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="center">
                <h2 style="margin:0;">DOLCE MIA</h2>
                <p>Sucursal Centro<br>RFC: XAXX010101000</p>
                <p class="bold">Orden #${selectedOrder.id}</p>
                <p>${new Date().toLocaleString()}</p>
            </div>
            <div class="line"></div>
            <table>${itemsRows}</table>
            <div class="line"></div>
            <table>
                <tr><td>Total</td><td class="bold" style="text-align: right; font-size: 16px;">${selectedOrder.total}</td></tr>
                <tr><td>Pago</td><td style="text-align: right;">${currentPaymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}</td></tr>
            </table>
            <div class="center" style="margin-top: 20px;">
                <p>¡Gracias por su visita!<br>www.dolcemia.com</p>
            </div>
            <script>window.print(); window.close();<\/script>
        </body>
        </html>
    `;

    const win = window.open('', '', 'width=300,height=600');
    win.document.write(ticketHTML);
    win.document.close();
};
