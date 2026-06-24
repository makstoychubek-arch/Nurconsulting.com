/**
 * NR Consulting — Основной модуль интерфейса и авторизации РНП
 */

// База сотрудников и их паролей доступа
const allowedStaff = {
    nurbolot: "founder78",
    marlen: "logistics12",
    insiya: "data33"
};

// Функция клика по карточке сотрудника для автоподстановки
function selectStaff(name) {
    const userInput = document.getElementById("wb-user");
    const passInput = document.getElementById("wb-pass");
    if (userInput) {
        userInput.value = name;
        passInput?.focus();
    }
}

// Открытие модального окна РНП
function openRnpAnalytics() {
    const modal = document.getElementById("wb-rnp-modal");
    if (modal) {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }
}

// Закрытие модального окна РНП
function closeRnpAnalytics() {
    const modal = document.getElementById("wb-rnp-modal");
    if (modal) {
        modal.classList.add("hidden");
        document.body.style.overflow = "auto";
    }
}

// Логика авторизации
function handleWbLogin() {
    const userInput = document.getElementById("wb-user");
    const passInput = document.getElementById("wb-pass");
    const err = document.getElementById("wb-auth-error");
    const authForm = document.getElementById("wb-auth-form");
    const dashboard = document.getElementById("wb-dashboard");
    const welcomeUser = document.getElementById("wb-welcome-user");

    if (!userInput || !passInput) return;

    const u = userInput.value.trim().toLowerCase();
    const p = passInput.value.trim();

    if (allowedStaff[u] && allowedStaff[u] === p) {
        err?.classList.add("hidden");
        authForm?.classList.add("hidden");     
        dashboard?.classList.remove("hidden");  
        if (welcomeUser) {
            welcomeUser.innerText = "Сотрудник: " + u.toUpperCase();
        }
        // Автоматически подставляем ранее сохраненный токен, если он есть
        const savedToken = localStorage.getItem(`wb_token_${u}`);
        const tokenInput = document.getElementById("wb-token-input");
        if (savedToken && tokenInput) {
            tokenInput.value = savedToken;
        }
    } else {
        err?.classList.remove("hidden"); 
    }
}

// Вызов функции из wb-api.js и обновление интерфейса реальными данными
async function fetchWbData() {
    const tokenInput = document.getElementById("wb-token-input");
    if (!tokenInput) return;

    const token = tokenInput.value.trim();
    if (!token) {
        alert("Введите рабочий API токен статистики Wildberries");
        return;
    }

    // Сохраняем токен в память для текущего сотрудника, чтобы не вводить каждый раз
    const currentUser = document.getElementById("wb-welcome-user")?.innerText.split(": ")[1]?.toLowerCase();
    if (currentUser) {
        localStorage.setItem(`wb_token_${currentUser}`, token);
    }

    const loading = document.getElementById("wb-loading");
    const statsGrid = document.getElementById("wb-stats-grid");

    loading?.classList.remove("hidden");
    statsGrid?.classList.add("opacity-30");

    try {
        // Вызываем функцию из файла wb-api.js
        const data = await fetchWbFullData(token);

        // Обновляем карточки показателей (по ID из твоего HTML)
        document.getElementById("wb-orders-today").innerText = data.ordersSum.toLocaleString("ru-RU") + " ₽";
        document.getElementById("wb-orders-count").innerText = `Всего: ${data.ordersCount} шт.`;
        
        document.getElementById("wb-sales-today").innerText = data.salesSum.toLocaleString("ru-RU") + " ₽";
        document.getElementById("wb-sales-count").innerText = `Позиций: ${data.salesCount} шт.`;
        
        document.getElementById("wb-stock-total").innerText = data.stockTotal.toLocaleString("ru-RU") + " шт.";
        document.getElementById("wb-conversion").innerText = data.conversion + "%";

        // Рендеринг таблицы топ артикулов
        const tableBody = document.getElementById("wb-products-table");
        if (tableBody) {
            tableBody.innerHTML = "";

            if (data.stocksRaw && data.stocksRaw.length > 0) {
                data.stocksRaw.slice(0, 30).forEach(prod => {
                    const tr = document.createElement("tr");
                    tr.className = "border-b border-white/5 hover:bg-white/[0.02] transition";
                    const isEnough = (prod.quantity || 0) > 10;

                    tr.innerHTML = `
                        <td class="p-3 text-purple-400 font-semibold">${prod.nmId || "-"}</td>
                        <td class="p-3 text-gray-400">${prod.barcode || "-"}</td>
                        <td class="p-3 text-white font-bold">${prod.quantity || 0}</td>
                        <td class="p-3 text-gray-400">${prod.inWayToClient || 0}</td>
                        <td class="p-3">
                            <span class="${isEnough ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-1 rounded text-[10px] inline-block min-w-[85px] text-center">
                                ${isEnough ? "Достаточно" : "Подсорт"}
                            </span>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                });
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-gray-500 font-sans">Данных по остаткам в API кабинета не обнаружено.</td>
                    </tr>
                `;
            }
        }

    } catch (error) {
        alert(`Не удалось синхронизировать данные:\n${error.message}`);
    } finally {
        loading?.classList.add("hidden");
        statsGrid?.classList.remove("opacity-30");
    }
}

// Слушатели закрытия окна по клику мимо и по ESC
document.addEventListener("click", function (e) {
    const modal = document.getElementById("wb-rnp-modal");
    if (modal && !modal.classList.contains("hidden") && e.target === modal) {
        closeRnpAnalytics();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeRnpAnalytics();
});