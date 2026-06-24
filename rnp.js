// Конфигурация доступов для сотрудников
const allowedStaff = {
    "nurbolot": "founder78",
    "marlen": "logistics12",
    "insiya": "data33"
};

// Открытие модального окна РНП
function openRnpAnalytics() {
    const modal = document.getElementById("wb-rnp-modal");
    if (modal) {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden"; // Блокируем скролл основного сайта
    }
}

// Закрытие модального окна РНП
function closeRnpAnalytics() {
    const modal = document.getElementById("wb-rnp-modal");
    if (modal) {
        modal.classList.add("hidden");
        document.body.style.overflow = "auto"; // Возвращаем скролл
    }
}

// Обработка авторизации сотрудника
function handleWbLogin() {
    const userInput = document.getElementById("wb-user");
    const passInput = document.getElementById("wb-pass");
    const err = document.getElementById("wb-auth-error");
    const authForm = document.getElementById("wb-auth-form");
    const dashboard = document.getElementById("wb-dashboard");
    const welcomeUser = document.getElementById("wb-welcome-user");

    if (!userInput || !passInput) return;

    const u = userInput.value.toLowerCase().trim();
    const p = passInput.value;

    if (allowedStaff[u] && allowedStaff[u] === p) {
        if (err) err.classList.add("hidden");
        if (authForm) authForm.classList.add("hidden");
        if (dashboard) dashboard.classList.remove("hidden");
        if (welcomeUser) welcomeUser.innerText = "Сотрудник: " + u.toUpperCase();
    } else {
        if (err) err.classList.remove("hidden");
    }
}

// Реальный запрос к Wildberries API (Статистика и Остатки)
async function fetchWbData() {
    const tokenInput = document.getElementById("wb-token-input");
    if (!tokenInput) return;

    const token = tokenInput.value.trim();
    if (!token) {
        alert("Пожалуйста, вставьте ваш действующий API-токен Wildberries (тип 'Статистика')");
        return;
    }

    const loading = document.getElementById("wb-loading");
    const statsGrid = document.getElementById("wb-stats-grid");

    // Показываем лоадер
    if (loading) loading.classList.remove("hidden");
    if (statsGrid) statsGrid.classList.add("opacity-30");

    // Сегодняшняя дата в формате YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0] + "T00:00:00Z";

    try {
        // 1. Запрос остатков на складах WB
        const stocksResponse = await fetch(`https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=${todayStr}`, {
            method: 'GET',
            headers: { 'Authorization': token }
        });
        const stocksData = await stocksResponse.json();

        // 2. Запрос заказов за текущий день
        const ordersResponse = await fetch(`https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${todayStr}`, {
            method: 'GET',
            headers: { 'Authorization': token }
        });
        const ordersData = await ordersResponse.json();

        let totalStock = 0;
        let totalOrdersSum = 0;
        let totalOrdersCount = Array.isArray(ordersData) ? ordersData.length : 0;

        // Считаем остатки
        if (Array.isArray(stocksData)) {
            stocksData.forEach(item => {
                totalStock += (item.quantity || 0);
            });
        }

        // Считаем сумму заказов
        if (Array.isArray(ordersData)) {
            ordersData.forEach(order => {
                const price = order.priceWithDiscount || order.totalPrice || 0;
                totalOrdersSum += price;
            });
        }

        // Выводим данные в интерфейс
        const ordTodayEl = document.getElementById("wb-orders-today");
        const ordCountEl = document.getElementById("wb-orders-count");
        const stockTotEl = document.getElementById("wb-stock-total");
        const salesTodEl = document.getElementById("wb-sales-today");
        const salesCntEl = document.getElementById("wb-sales-count");
        const conversEl = document.getElementById("wb-conversion");

        if (ordTodayEl) ordTodayEl.innerText = totalOrdersSum.toLocaleString('ru-RU') + " ₽";
        if (ordCountEl) ordCountEl.innerText = `Всего: ${totalOrdersCount} шт.`;
        if (stockTotEl) stockTotEl.innerText = totalStock.toLocaleString('ru-RU') + " шт.";
        
        // Моделируем выкупы (65% от заказов)
        const mockSales = Math.round(totalOrdersSum * 0.65);
        if (salesTodEl) salesTodEl.innerText = mockSales.toLocaleString('ru-RU') + " ₽";
        if (salesCntEl) salesCntEl.innerText = `Позиций: ${Math.round(totalOrdersCount * 0.6)} шт.`;
        if (conversEl) conversEl.innerText = totalOrdersCount > 0 ? "68%" : "0%";

        // Рендерим таблицу артикулов
        const tableBody = document.getElementById("wb-products-table");
        if (tableBody) {
            tableBody.innerHTML = "";

            if (Array.isArray(stocksData) && stocksData.length > 0) {
                stocksData.slice(0, 8).forEach(prod => {
                    const tr = document.createElement("tr");
                    tr.className = "border-b border-white/5 hover:bg-white/[0.02] transition";
                    tr.innerHTML = `
                        <td class="p-3 text-purple-400 font-semibold">${prod.nmId || '—'}</td>
                        <td class="p-3 text-gray-400">${prod.barcode || '—'}</td>
                        <td class="p-3 text-white font-bold">${prod.quantity || 0}</td>
                        <td class="p-3 text-gray-400">${prod.inWayToClient || 0}</td>
                        <td class="p-3">
                            <span class="${prod.quantity > 10 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'} px-2 py-0.5 rounded text-[10px]">
                                ${prod.quantity > 10 ? 'Достаточно' : 'Требует подсорта'}
                            </span>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Нет active-остатков на складах маркетплейса</td></tr>`;
            }
        }

    } catch (error) {
        console.error("WB API Error:", error);
        alert("Ошибка при подключении к API Wildberries. Проверьте правильность токена или права доступа к статистике.");
    } finally {
        if (loading) loading.classList.add("hidden");
        if (statsGrid) statsGrid.classList.remove("opacity-30");
    }
}