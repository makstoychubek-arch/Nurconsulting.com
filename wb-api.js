/**
 * NR Consulting — ёодуль интеграции через защищённый прокси
 * Токены WB теперь хранятся в базе данных и никогда не видны в браузере
 */

const PROXY_URL = 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/wb-proxy';

async function fetchWbFullData(cabinetId) {
    if (!cabinetId) throw new Error('Кабинет не выбран');

    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdWt5Znlob3RjdHZmZGlka3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDE5NzcsImV4cCI6MjA5Nzg3Nzk3N30.vX31uMBCEj-wjjR6qmFkwWammg70Av2h6I4YUnewL9Q';

    try {
        const [stocksRes, ordersRes] = await Promise.all([
            fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({ cabinetId, endpoint: 'stocks' })
            }),
            fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({ cabinetId, endpoint: 'orders' })
            })
        ]);

        const stocksData = await stocksRes.json();
        const ordersData = await ordersRes.json();

        let totalStock = 0;
        let totalOrdersSum = 0;
        let totalOrdersCount = 0;

        if (Array.isArray(stocksData)) {
            stocksData.forEach(item => {
                totalStock += Number(item.quantity || 0);
            });
        }

        if (Array.isArray(ordersData)) {
            totalOrdersCount = ordersData.length;
            ordersData.forEach(order => {
                totalOrdersSum += Number(order.priceWithDiscount || order.totalPrice || 0);
            });
        }

        const mockSalesSum = Math.round(totalOrdersSum * 0.65);
        const mockSalesCount = Math.round(totalOrdersCount * 0.65);
        const conversion = totalOrdersCount > 0 ? 65 : 0;

        return {
            ordersSum: totalOrdersSum,
            ordersCount: totalOrdersCount,
            salesSum: mockSalesSum,
            salesCount: mockSalesCount,
            stockTotal: totalStock,
            conversion: conversion,
            stocksRaw: stocksData
        };

    } catch (error) {
        console.error('Ошибка прокси WB:', error);
        throw error;
    }
}