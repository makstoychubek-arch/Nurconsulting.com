# Окно кампании: что умеет публичный API WB

Источник: официальная спека «Маркетинг и продвижение» (`docs/wb-openapi-promotion.yaml`, снято 10.09.2026), dev.wildberries.ru/openapi/promotion.

| Элемент макета | В API WB | Метод |
| --- | --- | --- |
| Завершить | есть | `GET https://advert-api.wildberries.ru/adv/v0/stop?id={advertId}`. Статусы 9 (активна) и 11 (пауза) переходят в 7. Необратимо. 5 запросов в секунду. 200 ок, 422 «статус не изменён», 400 неверный id. |
| Зоны «Поиск» / «Рекомендации» | есть, но только ручная ставка и оплата за показы (cpm) | `PUT /adv/v0/auction/placements`, тело `{"placements":[{"advert_id":N,"placements":{"search":bool,"recommendations":bool}}]}`, до 50 кампаний, статусы 4/9/11, 1 запрос в секунду, ответ 204. У cpc и единой ставки WB отвечает 400 (`placements cannot be changed`). Чтение: `GET /api/advert/v2/adverts` → `settings.placements.{search,recommendations}`. |
| Дата создания | есть (чтение) | `GET /api/advert/v2/adverts` → `timestamps.created` (также `started`, `updated`, `deleted`). |
| Дневной лимит | в API нет | Поле `daily_limit` есть только у баннеров WB Медиа (`GET /adv/v1/advert`), для обычных кампаний продвижения нет ни чтения, ни записи. |
| Автопополнение бюджета | в API нет | Есть только разовое пополнение `POST /adv/v1/budget/deposit` и чтение бюджета `GET /adv/v1/budget` (по аудиту автобиддера пополнение руками в ЛК, мы его не автоматизируем). |
| История изменений | в API нет | Журнала изменений кампании нет. Есть история затрат `/adv/v1/upd` и пополнений `/adv/v1/payments`, это деньги, не правки. На сайте «История» строится из нашей очереди `adv_ops` и показывает только то, что сделано через NR Space. |
