/* Слайды инструкции «Как создать токен WB» (мастер Акылай и подключение кабинета).
   Картинки лежат в /img/akylai, личные данные на скриншотах закрыты. */
window.AK_SLIDES = [
    { img: 'step-1-api-settings.png', text: 'В кабинете продавца Wildberries нажмите на профиль справа вверху и выберите <b>«Интеграции по API»</b>. Ссылка сразу: <a href="https://seller.wildberries.ru/supplier-settings/access-to-api" target="_blank" rel="noopener">Доступ к API</a>. Если у вас несколько компаний (ИП, ООО), сначала выберите ту, чей магазин подключаете.' },
    { img: 'step-2-create-token.png', text: 'Нажмите <b>«Создать токен»</b>. Если там написано «20 из 20», удалите ненужный старый токен.' },
    { img: 'step-3-token-type.png', text: 'Вкладка «Для интеграции вручную». Тип токена — строго <b>«Персональный»</b>. Название любое, например «NR-Space». Отметьте <b>все категории</b>: Контент, Маркетплейс, Статистика, Финансы, Аналитика, Продвижение, «Вопросы и отзывы», Цены и скидки, Поставки. Без «Финансов» не посчитается прибыль, без «Вопросов и отзывов» не заработает Акылай. Поставьте галочку «Я понимаю…».' },
    { img: 'step-4-access.png', text: 'Уровень доступа — обязательно <b>«Чтение и запись»</b>. «Только чтение» не подойдёт: с ним не работают А/Б-тесты, автобиддер и ответы на отзывы. Нажмите «Создать токен» и скопируйте его целиком.' },
    { input: true, text: 'Вставьте токен сюда — я проверю его сама, нажимать ничего не нужно.' },
];

/* Окно «Как создать токен»: те же слайды, что в мастере Акылай, но без поля ввода. */
(function (root) {
    var doc = root.document, i = 0, ov = null;
    var slides = function () { return root.AK_SLIDES.filter(function (s) { return s.img; }); };
    function draw() {
        var list = slides(), s = list[i], last = i === list.length - 1;
        ov.querySelector('.tg-body').innerHTML =
            '<img class="tg-img" src="/img/akylai/' + s.img + '" alt="">' +
            '<div class="tg-text">' + s.text + '</div>';
        ov.querySelector('.tg-step').textContent = 'Шаг ' + (i + 1) + ' из ' + list.length;
        ov.querySelector('.tg-dots').innerHTML = list.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('');
        ov.querySelector('.tg-prev').disabled = i === 0;
        var next = ov.querySelector('.tg-next');
        next.textContent = last ? 'Готово' : 'Далее';
        next.onclick = last ? close : function () { i++; draw(); };
    }
    function close() { if (ov) { ov.remove(); ov = null; } doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    root.openTokenGuide = function () {
        if (ov) return;
        i = 0;
        ov = doc.createElement('div');
        ov.className = 'tg-overlay';
        ov.innerHTML = '<div class="tg-box nr-win" role="dialog" aria-modal="true">' +
            '<div class="tg-head"><div><div class="tg-title">Как создать токен WB</div><div class="tg-step"></div></div>' +
            '<button type="button" class="tg-x" aria-label="Закрыть">×</button></div>' +
            '<div class="tg-body"></div>' +
            '<div class="tg-nav"><button type="button" class="tg-prev ui-btn ui-btn-secondary">Назад</button>' +
            '<div class="tg-dots"></div><button type="button" class="tg-next ui-btn">Далее</button></div></div>';
        doc.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        ov.querySelector('.tg-x').onclick = close;
        ov.querySelector('.tg-prev').onclick = function () { if (i > 0) { i--; draw(); } };
        doc.addEventListener('keydown', onKey, true);
        draw();
    };
})(window);
