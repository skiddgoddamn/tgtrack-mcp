# Подключение своего бота к tgtrack + BotHelp (playbook)

Что MCP **умеет** (после того как бот уже в аккаунте): читать каналы/боты, интеграции,
скрипт лендинга, цели, ссылки, минтить API-ключ. Чего MCP **не умеет** и делается руками:
первичная регистрация бота (интерактивное меню `@tgTrack_bot`) и проводка событий в BotHelp.
Отправку токена боту из агента блокирует предохранитель харнесса — этот шаг всегда владелец.

Источники: https://doc.tgtrack.ru/doc/connecting-your-bot · /doc/connect-bothelp ·
/doc/sozdat-trekingovuyu-ssylku-v-bote · /doc/utm-tags · /doc/yandex-direkt

## Шаги

1. **[@tgTrack_bot, вручную]** Меню (кнопка слева от поля ввода) → **«Подключить/настроить
   своего бота»**. Просто вставить токен без выбора пункта меню — бот отвечает
   «выберите, что я должен сделать» и НЕ регистрирует.
2. **[@tgTrack_bot, вручную]** Вставить актуальный токен бота из @BotFather. Сервис читает
   токен один раз (забирает данные бота у Telegram), **webhook не ставит** — бот остаётся на
   своей платформе (BotHelp). Токен после подключения можно перевыпускать.
3. **[MCP]** Убедиться, что бот появился: `tgtrack_list_channels` → взять `chatID`.
   Детали: `tgtrack_get_channel {chatID}` (интеграции, ссылки, счётчик, настройки скрипта).
4. **[MCP / панель]** Взять **API-ключ** бота (нужен для Bot API ниже). В MCP — минт нового:
   `tgtrack_new_api_token {confirm:true}` (⚠️ инвалидирует предыдущий, если был).
5. **[BotHelp]** В сценарии на **старте бота** добавить блок **«Отправить данные подписчика
   через Webhook»**: `POST https://bot-api.tgtrack.ru/v1/<API_KEY>/my_bothelp_was_started`.
   Этим tgtrack получает старт и метку источника (из deep-link `?start=<код>`).
6. **[BotHelp, опц.]** Глубокая цель — блок «Внешний запрос»:
   `POST https://bot-api.tgtrack.ru/v1/<API_KEY>/send_reach_goal`
   body `{"user_id":"{%user_id%}","target":"<имя_цели>"}`.
7. **[BotHelp, опц.]** Забрать метки в бота: `POST .../v1/<API_KEY>/get_user_info` body
   `{user_id}` → `utm_source/medium/campaign/content/term` (последняя подписка, 30 дней).
8. **[MCP]** Реклама/конверсии: `tgtrack_create_integration` (yandex → вернёт `grantAccessUrl`
   + `webCreationCode`, OAuth добить в браузере), `tgtrack_update_goal`,
   `tgtrack_yandex_web_create_status`. Скрипт для лендинга: `tgtrack_get_integration_script
   {linkID, counterID}`.
9. **[Проверка]** `https://bot-api.tgtrack.ru/last_events/` (с API-ключом) — видно ли долетают
   события; `tgtrack_get_channel` — что источники размечаются.

## Bot API (эндпоинты)

База: `https://bot-api.tgtrack.ru/v1/<API_KEY>/<method>` (для MAX база
`https://max.tgtrack.ru/API/bot-api/v1/<API_KEY>/`).

| Метод | Назначение |
|-------|-----------|
| `my_bothelp_was_started` (POST) | событие «старт бота» из BotHelp |
| `send_reach_goal` (POST) | глубокая цель `{user_id, target}` |
| `get_user_info` (POST) | вернуть utm-метки по `{user_id}` |
| `last_events/` (GET) | проверить последние долетевшие события |

## Трек-ссылки (несколько кампаний на один бот)

`@tgTrack_bot` → меню **«Создать трекинг ссылку»** → выбрать бота → имя источника (до 99
символов, видно в отчёте) → получаешь две ссылки (посевы TG / внешние источники, deep-link
`t.me/<bot>?start=<код>`). Разделение источников — уникальная метка на кампанию: отдельная
ссылка на постоянный источник, либо одна ссылка + UTM для разовых. Кампании могут быть с
разных рекламных кабинетов — важно лишь, чтобы метки не повторялись.
