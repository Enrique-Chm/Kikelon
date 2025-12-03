// --- LÓGICA DE ANALÍTICA ULTIMATE (Dolce Mia) ---

let allOrders = []; // Todos los datos crudos
let allUsers = {};  // Base de datos de usuarios
let filteredOrders = []; // Datos filtrados por fecha
let charts = {}; // Referencias a gráficas para destruirlas al actualizar

document.addEventListener('DOMContentLoaded', () => {
    // Establecer fecha de hoy por defecto en los inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-start').value = today;
    document.getElementById('date-end').value = today;

    loadData();
});

function loadData() {
    // Cargar órdenes
    allOrders = JSON.parse(localStorage.getItem('dolce_mia_orders') || '[]');
    
    // Cargar usuarios (para demografía)
    allUsers = JSON.parse(localStorage.getItem('dolce_mia_users') || '{}');

    // Aplicar filtro inicial (Hoy)
    applyDateFilter();
}

// --- SISTEMA DE FILTRADO ---

window.applyDateFilter = () => {
    const startStr = document.getElementById('date-start').value;
    const endStr = document.getElementById('date-end').value;

    if (!startStr || !endStr) return alert("Selecciona un rango de fechas válido.");

    // Convertir a timestamps (Inicio del día 00:00 y Fin del día 23:59)
    // Nota: Usamos replace(/-/g, '/') para evitar problemas de zona horaria en algunos navegadores
    const startDate = new Date(startStr + 'T00:00:00').getTime();
    const endDate = new Date(endStr + 'T23:59:59').getTime();

    filteredOrders = allOrders.filter(o => o.startTime >= startDate && o.startTime <= endDate);

    // Re-calcular todo con los datos filtrados
    refreshAllDashboards();
};

window.resetDateFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-start').value = today;
    document.getElementById('date-end').value = today;
    applyDateFilter();
};

function refreshAllDashboards() {
    calculateSales();
    calculateOps();
    calculateCustomers();
}

// --- CONTROL DE PESTAÑAS ---
window.switchTab = (tabName) => {
    // Reset estilos
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(`tab-btn-${tabName}`).classList.add('tab-active');

    // Visibilidad
    ['sales', 'ops', 'customers'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(v === tabName) {
            el.classList.remove('hidden');
            // Hack para Chart.js: A veces no renderiza bien si el contenedor estaba oculto
            // Forzamos un pequeño resize event o re-render
        } else {
            el.classList.add('hidden');
        }
    });
};

// ==========================================
// 1. PESTAÑA VENTAS & MENÚ
// ==========================================
function calculateSales() {
    let totalSales = 0;
    let totalItems = 0;
    const catCount = {};
    const prodCount = {};
    const modCount = {}; // Para Extras

    filteredOrders.forEach(o => {
        totalSales += parseFloat(o.total.replace(/[$,]/g, ''));
        o.items.forEach(i => {
            totalItems += i.qty;
            
            // Categorías
            catCount[i.category] = (catCount[i.category] || 0) + i.qty;
            
            // Productos
            prodCount[i.name] = (prodCount[i.name] || 0) + i.qty;

            // Modificadores (Extras)
            if (i.selectedModifiers && i.selectedModifiers.length > 0) {
                i.selectedModifiers.forEach(mod => {
                    modCount[mod.name] = (modCount[mod.name] || 0) + i.qty;
                });
            }
        });
    });

    // Render KPIs
    document.getElementById('kpi-sales').textContent = formatMoney(totalSales);
    document.getElementById('kpi-orders').textContent = filteredOrders.length;
    document.getElementById('kpi-ticket').textContent = filteredOrders.length ? formatMoney(totalSales / filteredOrders.length) : "$0.00";
    document.getElementById('kpi-items').textContent = totalItems;

    // Gráfica Top Productos
    const topProds = Object.entries(prodCount).sort((a,b) => b[1] - a[1]).slice(0, 10);
    renderChart('chartTopProducts', 'bar', {
        labels: topProds.map(p => p[0]),
        datasets: [{ label: 'Ventas', data: topProds.map(p => p[1]), backgroundColor: '#ef4444', borderRadius: 4 }]
    });

    // Gráfica Categorías
    renderChart('chartCategories', 'doughnut', {
        labels: Object.keys(catCount),
        datasets: [{ 
            data: Object.values(catCount), 
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
            borderWidth: 0
        }]
    });

    // Gráfica Modificadores (Upselling)
    const topMods = Object.entries(modCount).sort((a,b) => b[1] - a[1]).slice(0, 8);
    renderChart('chartModifiers', 'bar', {
        labels: topMods.map(m => m[0]),
        datasets: [{ 
            label: 'Extras Vendidos', 
            data: topMods.map(m => m[1]), 
            backgroundColor: '#8b5cf6',
            indexAxis: 'y' // Barra horizontal
        }]
    });
}

// ==========================================
// 2. PESTAÑA OPERACIONES
// ==========================================
function calculateOps() {
    let totalTime = 0;
    let countedOrders = 0;
    let delayedOrders = 0;
    const hoursCount = {};
    const slowestOrders = [];

    // Tiempos por estación (Simulación basada en categorías)
    let timeKitchen = { total: 0, count: 0 };
    let timeBar = { total: 0, count: 0 };

    filteredOrders.forEach(o => {
        // Hora Pico
        const h = new Date(o.startTime).getHours();
        hoursCount[`${h}:00`] = (hoursCount[`${h}:00`] || 0) + 1;

        // Calcular duración
        let duration = 0;
        if (o.durationMinutes) {
            duration = o.durationMinutes;
        } else {
            // Si sigue abierta, calculamos tiempo hasta ahora
            duration = (new Date().getTime() - o.startTime) / 60000;
        }

        totalTime += duration;
        countedOrders++;

        if (duration > 20) delayedOrders++;

        // Top Lentas
        slowestOrders.push({ id: o.id, time: o.timeString, duration, items: o.items.length });

        // Simulación de Tiempos por Estación 
        // (En un sistema real, leeríamos o.status_cocina timestamp, pero aquí aproximaremos)
        const hasKitchen = o.items.some(i => !i.category.includes('Bebida'));
        const hasBar = o.items.some(i => i.category.includes('Bebida'));

        if(o.durationMinutes) {
            if(hasKitchen) { timeKitchen.total += duration; timeKitchen.count++; }
            if(hasBar) { timeBar.total += (duration * 0.4); timeBar.count++; } // Barra suele ser más rápida
        }
    });

    // KPIs Ops
    const avgTime = countedOrders ? (totalTime / countedOrders).toFixed(1) : 0;
    const delayedPct = countedOrders ? ((delayedOrders / countedOrders) * 100).toFixed(0) : 0;
    const peakHourEntry = Object.entries(hoursCount).sort((a,b) => b[1] - a[1])[0];

    document.getElementById('kpi-avg-time').textContent = avgTime;
    document.getElementById('kpi-delayed-pct').textContent = `${delayedPct}%`;
    document.getElementById('kpi-delayed-count').textContent = `${delayedOrders} órdenes`;
    document.getElementById('kpi-peak-hour').textContent = peakHourEntry ? peakHourEntry[0] : "--:--";

    // Gráfica Barra vs Cocina
    const avgKitchen = timeKitchen.count ? (timeKitchen.total / timeKitchen.count).toFixed(1) : 0;
    const avgBar = timeBar.count ? (timeBar.total / timeBar.count).toFixed(1) : 0;

    renderChart('chartStations', 'bar', {
        labels: ['Cocina 🍳', 'Barra 🍹'],
        datasets: [{
            label: 'Tiempo Promedio (min)',
            data: [avgKitchen, avgBar],
            backgroundColor: ['#f59e0b', '#3b82f6'],
            borderRadius: 5,
            barThickness: 50
        }]
    });

    // Gráfica SLA
    const slaData = [
        slowestOrders.filter(o => o.duration < 10).length,
        slowestOrders.filter(o => o.duration >= 10 && o.duration < 20).length,
        slowestOrders.filter(o => o.duration >= 20).length
    ];
    renderChart('chartSla', 'doughnut', {
        labels: ['<10m (Bueno)', '10-20m (Atención)', '>20m (Malo)'],
        datasets: [{ data: slaData, backgroundColor: ['#22c55e', '#eab308', '#ef4444'], borderWidth: 0 }]
    });

    // Tabla Lenta
    const tbody = document.getElementById('table-slowest');
    tbody.innerHTML = '';
    slowestOrders.sort((a,b) => b.duration - a.duration).slice(0, 5).forEach(o => {
        tbody.innerHTML += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-mono">#${o.id}</td>
                <td class="p-3 text-gray-500">${o.time}</td>
                <td class="p-3 font-bold text-red-600">${o.duration.toFixed(1)} min</td>
                <td class="p-3 text-sm">${o.items} items</td>
            </tr>`;
    });
}

// ==========================================
// 3. PESTAÑA CLIENTES (DEMOGRAFÍA)
// ==========================================
function calculateCustomers() {
    // Necesitamos cruzar las órdenes con los usuarios
    // La orden tiene 'client' (nombre) o podríamos buscar por teléfono si lo guardáramos en la orden
    // Para este demo, usaremos el nombre del cliente en la orden para buscar en allUsers
    
    const genderCount = { 'Masculino': 0, 'Femenino': 0, 'Otro': 0 };
    const ageCount = { '18-30': 0, '31-50': 0, '51+': 0 };
    const hourlySpend = {}; // Hora -> Total gastado

    // Mapeo simple de usuarios por nombre para búsqueda rápida
    const userMap = {};
    Object.values(allUsers).forEach(u => userMap[u.name] = u);

    let matchedUsers = 0;

    filteredOrders.forEach(o => {
        // Análisis de gasto por hora
        const h = new Date(o.startTime).getHours();
        const total = parseFloat(o.total.replace(/[$,]/g, ''));
        
        if(!hourlySpend[h]) hourlySpend[h] = { total: 0, count: 0 };
        hourlySpend[h].total += total;
        hourlySpend[h].count++;

        // Demografía
        // Buscamos si el cliente de la orden existe en nuestra base de usuarios
        // (Nota: Esto es aproximado si hay nombres duplicados, idealmente usaríamos Phone en la orden)
        const user = userMap[o.client];
        if (user) {
            matchedUsers++;
            if(user.gender) genderCount[user.gender]++;
            if(user.age) ageCount[user.age]++;
        }
    });

    // Gráfica Género
    renderChart('chartGender', 'pie', {
        labels: Object.keys(genderCount),
        datasets: [{ data: Object.values(genderCount), backgroundColor: ['#3b82f6', '#ec4899', '#94a3b8'], borderWidth: 0 }]
    });

    // Gráfica Edad
    renderChart('chartAge', 'bar', {
        labels: Object.keys(ageCount),
        datasets: [{ 
            label: 'Clientes', 
            data: Object.values(ageCount), 
            backgroundColor: ['#a78bfa', '#8b5cf6', '#7c3aed'], 
            borderRadius: 4 
        }]
    });

    // Gráfica Ticket Promedio por Hora
    // Rellenar horas vacías 0-23
    const hours = [];
    const avgTicketData = [];
    for(let i=9; i<=22; i++) { // Horario comercial 9am - 10pm
        hours.push(`${i}:00`);
        const d = hourlySpend[i];
        avgTicketData.push(d ? (d.total / d.count) : 0);
    }

    renderChart('chartHourlyTicket', 'line', {
        labels: hours,
        datasets: [{
            label: 'Ticket Promedio ($)',
            data: avgTicketData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
        }]
    });
}

// --- UTILIDADES ---

function renderChart(id, type, data) {
    const ctx = document.getElementById(id);
    if (!ctx) return; // Si estamos en otra pestaña oculta tal vez no exista

    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            animation: { duration: 500 }
        }
    });
}

function formatMoney(amount) {
    return '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

window.downloadCSV = function() {
    if (filteredOrders.length === 0) return alert("No hay datos en este rango de fechas.");

    let csv = "ID,Cliente,Fecha,Hora,Total,Items,Duracion (min)\n";
    
    filteredOrders.forEach(o => {
        const date = new Date(o.startTime).toLocaleDateString();
        const duration = o.durationMinutes ? o.durationMinutes.toFixed(1) : "Activa";
        const itemsStr = o.items.map(i => `${i.qty}x ${i.name}`).join(" | ");
        // Escapar comillas en items
        const safeItems = itemsStr.replace(/"/g, '""');
        
        csv += `${o.id},"${o.client}",${date},${o.timeString},"${o.total}","${safeItems}",${duration}\n`;
    });

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    link.download = `ventas_${document.getElementById('date-start').value}.csv`;
    link.click();
};
