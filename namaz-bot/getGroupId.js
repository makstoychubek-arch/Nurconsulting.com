'use strict';

/**
 * Вспомогательный скрипт: выводит список чатов/групп и их chatId.
 * Запуск: npm run get-group-id
 * Нужны в .env: GREEN_API_ID_INSTANCE, GREEN_API_TOKEN
 */

require('dotenv').config();

const { getChats } = require('./services/whatsapp');

async function main() {
  const data = await getChats();
  const chats = Array.isArray(data) ? data : data?.data || data?.chats || [];

  if (!Array.isArray(chats) || !chats.length) {
    console.log('Ответ Green API getChats:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const groups = chats.filter((c) => String(c.id || c.chatId || '').endsWith('@g.us'));
  console.log(`Всего чатов: ${chats.length}, групп: ${groups.length}\n`);

  for (const g of groups) {
    const id = g.id || g.chatId;
    const name = g.name || g.subject || g.contactName || '(без названия)';
    console.log(`${id}\t${name}`);
  }

  console.log('\nСкопируй нужный id в .env → GREEN_API_GROUP_CHAT_ID');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
