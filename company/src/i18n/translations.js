export const SUPPORTED_LANGS = ["en", "ru", "uz"];

export const LANG_OPTIONS = [
  { id: "en", label: "ENG" },
  { id: "ru", label: "RUS" },
  { id: "uz", label: "UZB" },
];

export const LANG_STORAGE_KEY = "qrmenu-company-lang";

export const LOCALE_BY_LANG = {
  en: "en-US",
  ru: "ru-RU",
  uz: "uz-UZ",
};

const en = {
  // Nav
  "nav.demo": "Demo",
  "nav.products": "Products",
  "nav.platform": "Platform",
  "nav.pricing": "Pricing",
  "nav.contact": "Contact",
  "nav.faq": "FAQ",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.contactCta": "Contact",

  // Hero
  "hero.title": "Your dining room, live on every screen.",
  "hero.lead":
    "Guests order from their phone. Staff run the floor on tablet. Owners see it all on desktop.",
  "hero.ctaWalkthrough": "Schedule a walkthrough",
  "hero.ctaWatch": "Watch the product",
  "hero.stageAria": "Product on phone and tablet",
  "hero.altLaptop": "QRMenu admin dashboard on laptop",
  "hero.altTablet": "Live floor board on tablet",
  "hero.altPhone": "Guest menu on phone",

  // Video
  "video.eyebrow": "Product film",
  "video.title": "See a full service in two minutes.",
  "video.lead": "From QR scan to live floor — watch how guests and staff stay on one system.",
  "video.chrome": "QRMenu · product tour",
  "video.shot1": "Guest scans",
  "video.shot2": "Floor updates",
  "video.shot3": "Kitchen clears",
  "video.hint": "Your product film plays here",
  "video.play": "Play product video",
  "video.pause": "Pause video",
  "video.soon": "Video coming soon",
  "video.rail1": "Scan",
  "video.rail2": "Order",
  "video.rail3": "Floor",
  "video.rail4": "Kitchen",
  "video.rail5": "Insights",

  // Products section
  "products.eyebrow": "Our products",
  "products.title": "Built for real service moments.",
  "products.lead": "Each capability, shown the way guests and staff actually use it.",
  "products.details": "Details",

  "product.online-menu.title": "Online QR menu",
  "product.online-menu.kicker": "Guest experience",
  "product.online-menu.p1": "Guests open your branded menu from a table QR code",
  "product.online-menu.p2": "Photos, categories, and dietary notes built for mobile",
  "product.online-menu.p3": "Live availability — hide sold-out items instantly",
  "product.online-menu.p4": "Works on any phone, no app install required",

  "product.table-ordering.title": "QR orders to table",
  "product.table-ordering.kicker": "Guest experience",
  "product.table-ordering.p1": "Guests build and send orders from their seat",
  "product.table-ordering.p2": "Clear modifiers, quantities, and totals before submit",
  "product.table-ordering.p3": "Personal order submit goes straight to your team",
  "product.table-ordering.p4": "Less waiting on staff for every item request",

  "product.order-receiving.title": "Live order receiving",
  "product.order-receiving.kicker": "Floor & kitchen",
  "product.order-receiving.p1": "New table orders appear on floor and kitchen views",
  "product.order-receiving.p2": "Track status from received to fired to cleared",
  "product.order-receiving.p3": "Table-aware tickets reduce handoff misses",
  "product.order-receiving.p4": "Run service from phone or tablet during rush",

  "product.menu-admin.title": "Live menu control",
  "product.menu-admin.kicker": "Owner & admin",
  "product.menu-admin.p1": "Owners update prices and items in one admin place",
  "product.menu-admin.p2": "Publish once — guest menus refresh automatically",
  "product.menu-admin.p3": "Hide items mid-service without reprinting",
  "product.menu-admin.p4": "Roles keep staff and managers on the right access",

  "product.staff-orders.title": "Staff manual orders",
  "product.staff-orders.kicker": "Floor & staff",
  "product.staff-orders.p1": "Servers enter orders for guests who prefer not to use QR",
  "product.staff-orders.p2": "Same live ticket flow as guest-submitted orders",
  "product.staff-orders.p3": "Attach items to the right table in seconds",
  "product.staff-orders.p4": "Ideal for VIP tables, phone orders, or busy handoffs",

  "product.reservations.title": "Reservation system",
  "product.reservations.kicker": "Host & owner",
  "product.reservations.p1": "Take and manage bookings alongside live service",
  "product.reservations.p2": "See covers, times, and table assignments clearly",
  "product.reservations.p3": "Keep hosts aligned with kitchen pacing",
  "product.reservations.p4": "Scale from quiet nights to peak weekends",

  "product.feedback.title": "Guest feedback",
  "product.feedback.kicker": "Guest & owner",
  "product.feedback.p1": "Collect ratings right after the meal",
  "product.feedback.p2": "Review comments in one inbox for the team",
  "product.feedback.p3": "Spot service issues while they’re still useful",
  "product.feedback.p4": "Build a clearer picture of guest experience",

  // Ecosystem
  "eco.title": "Perfect ecosystem for restaurants and hotels",
  "eco.lead":
    "Flexibly customize every QRMenu feature and tool to raise efficiency across your business.",
  "eco.restaurants.title": "Restaurants",
  "eco.restaurants.text":
    "Launch a branded QR menu, take table orders, and keep the floor in sync from open to close.",
  "eco.cafes.title": "Cafes",
  "eco.cafes.text":
    "Speed up turns with live menus, pickup-ready orders, and clearer average-check prompts.",
  "eco.bars.title": "Bars",
  "eco.bars.text":
    "Serve digital drink lists, QR ordering at the table, and guest feedback after every visit.",
  "eco.hotels.title": "Hotels",
  "eco.hotels.text":
    "Handle room-service ordering, guest notes, and fewer handoff mistakes across shifts.",
  "eco.chains.title": "Restaurant and hotel chains",
  "eco.chains.text": "Keep menus, promotions, and service standards aligned across every location.",
  "eco.ghost.title": "Ghost kitchen",
  "eco.ghost.text":
    "Run digital-first ordering, fast menu updates, and cleaner customer data from one system.",

  // Platform
  "platform.eyebrow": "How it works",
  "platform.title": "Where QRMenu runs",
  "platform.lede":
    "Mobile for the floor. Web for the office. An online menu for guests — and a QR on every table that ties the order to the right seat.",
  "platform.table12": "Table 12",

  "platform.mobile.kicker": "Team · mobile",
  "platform.mobile.title": "Android & iOS app",
  "platform.mobile.text":
    "Live tickets, table status, and staff order entry from the floor — native apps for Android and iOS.",
  "platform.mobile.tag1": "Android",
  "platform.mobile.tag2": "iOS",

  "platform.admin.kicker": "Owner · web",
  "platform.admin.title": "Web app for laptops",
  "platform.admin.text":
    "Menus, hours, roles, and service settings in the browser — built for laptop and desktop control.",
  "platform.admin.tag1": "Laptop",
  "platform.admin.tag2": "Desktop",

  "platform.menu.kicker": "Guest · browser",
  "platform.menu.title": "Online menu",
  "platform.menu.text":
    "Guests open a branded menu on their phone — browse, customize, and send to kitchen with no download.",
  "platform.menu.tag1": "No app needed",

  "platform.qr.kicker": "Floor · tables",
  "platform.qr.title": "QR table numbers",
  "platform.qr.text":
    "One QR per table. Guests scan, land on the right seat, and every order stays tied to that number.",
  "platform.qr.tag1": "Printed stand",

  // Pricing
  "pricing.eyebrow": "Pricing",
  "pricing.title": "Start with QR orders. Add what you need.",
  "pricing.lead": "Choose a package — then contact us to activate it.",
  "pricing.monthly": "Monthly",
  "pricing.yearly": "Yearly",
  "pricing.save": "Save ~20%",
  "pricing.perLocationMonth": "per location / month",
  "pricing.billedYearly": ", billed yearly",
  "pricing.perYear": "{price} per year",
  "pricing.contactStart": "Contact us to get started",
  "pricing.choose": "Choose {name}",
  "pricing.mostPopular": "Most popular",
  "pricing.notePrefix": "After you choose a package, you will jump to ",
  "pricing.noteSuffix":
    " — Telegram, WhatsApp, phone, or email with a ready message.",
  "pricing.includesGrow": "Everything in Ordering, plus:",
  "pricing.includesOps": "Everything in Grow, plus:",

  "plan.ordering.name": "Ordering",
  "plan.ordering.tagline": "QR menu & online orders",
  "plan.ordering.feat1": "Branded QR codes for every table",
  "plan.ordering.feat2": "Live online guest menu",
  "plan.ordering.feat3": "Guest online ordering from the table",
  "plan.ordering.feat4": "Photos, prices & modifiers",
  "plan.ordering.feat5": "Instant menu updates (no reprints)",
  "plan.ordering.feat6": "Basic order inbox for the floor",
  "plan.ordering.no1": "Website & online reservations",
  "plan.ordering.no2": "Staff manual orders & POS bridge",

  "plan.grow.name": "Grow",
  "plan.grow.tagline": "Website & reservations",
  "plan.grow.feat1": "Restaurant website presence",
  "plan.grow.feat2": "Online table reservations",
  "plan.grow.feat3": "Reservation inbox & status control",
  "plan.grow.feat4": "Shareable booking link for guests",
  "plan.grow.feat5": "Menu + orders + bookings in one place",
  "plan.grow.no1": "Staff manual order entry",
  "plan.grow.no2": "POS bridge for the floor team",

  "plan.ops.name": "Ops",
  "plan.ops.tagline": "Staff orders & POS",
  "plan.ops.feat1": "Manual order submitting for staff",
  "plan.ops.feat2": "POS / bridge workflows for the floor",
  "plan.ops.feat3": "Staff mobile app (Android & iOS)",
  "plan.ops.feat4": "Web admin for owners & managers",
  "plan.ops.feat5": "Live tickets tied to table numbers",
  "plan.ops.feat6": "Full guest + staff ordering coverage",

  // FAQ
  "faq.eyebrow": "FAQ",
  "faq.title": "Common questions.",
  "faq.lead": "Short answers. If you have a unique setup, we can review it quickly.",
  "faq.q1": "Is this only for high-volume or fine dining?",
  "faq.a1": "No. It works for cafes, casual dining, and full table-service teams.",
  "faq.q2": "What does implementation look like for my team?",
  "faq.a2": "We run a structured setup for menu, roles, and team onboarding.",
  "faq.q3": "How do you handle changes after we are live?",
  "faq.a3": "You can update menu items, prices, and service rules at any time.",
  "faq.q4": "Do you work with more than one location?",
  "faq.a4": "Yes. Use shared standards across sites with local flexibility when needed.",
  "faq.q5": "Can we change plans after we go live?",
  "faq.a5": "Yes. Teams often start small and upgrade as they add locations or integrations.",
  "seo.title": "QRMenu — QR menu, table ordering, and restaurant operations",
  "seo.description":
    "QR menu and online ordering for restaurants in Uzbekistan. Guests scan a table code, order, and book. Staff run the floor from one live system.",
  "seo.skip": "Skip to content",

  // Contact
  "contact.eyebrow": "Contact",
  "contact.title": "Get in touch",
  "contact.lead": "Telegram, WhatsApp, phone, or email — we reply and help you get started.",
  "contact.selectedPackage": "Selected package",
  "contact.yearly": "Yearly",
  "contact.monthly": "Monthly",
  "contact.includedHint": "Included in your Telegram, WhatsApp, and email message.",
  "contact.clear": "Clear",
  "contact.call": "Call",
  "contact.telegram": "Telegram",
  "contact.whatsapp": "WhatsApp",
  "contact.email": "Email",
  "contact.msg.general":
    "Hi! I'd like to learn more about QRMenu for my restaurant. Please contact me with more info.",
  "contact.msg.interest":
    "Hi! I'm interested in the QRMenu {plan} package ({cycle}). {price} Please contact me to get started.",
  "contact.msg.priceMonthly": "Listed price: {price} so'm/mo.",
  "contact.msg.priceYearly": "Listed price: {price} so'm/mo billed yearly.",
  "contact.subject.general": "QRMenu — request for info",
  "contact.subject.plan": "QRMenu — {plan} ({billing})",

  // Footer
  "footer.blurb":
    "Digital menus, ordering, and back-of-house clarity for table-service restaurants.",
  "footer.product": "Product",
  "footer.contact": "Contact",
  "footer.company": "Company",
  "footer.messageUs": "Message us",
  "footer.choosePackage": "Choose a package",
  "footer.about": "About",
  "footer.whoFor": "Who it’s for",
  "footer.privacy": "Privacy policy",
  "footer.rights": "All rights reserved.",
};

const ru = {
  // Nav
  "nav.demo": "Демо",
  "nav.products": "Продукты",
  "nav.platform": "Платформа",
  "nav.pricing": "Тарифы",
  "nav.contact": "Контакты",
  "nav.faq": "FAQ",
  "nav.openMenu": "Открыть меню",
  "nav.closeMenu": "Закрыть меню",
  "nav.contactCta": "Связаться",

  // Hero
  "hero.title": "Ваш зал — в реальном времени на каждом экране.",
  "hero.lead":
    "Гости заказывают с телефона. Персонал ведёт зал с планшета. Владельцы видят всё с компьютера.",
  "hero.ctaWalkthrough": "Записаться на демо",
  "hero.ctaWatch": "Смотреть продукт",
  "hero.stageAria": "Продукт на телефоне и планшете",
  "hero.altLaptop": "Админ-панель QRMenu на ноутбуке",
  "hero.altTablet": "Живая доска зала на планшете",
  "hero.altPhone": "Гостевое меню на телефоне",

  // Video
  "video.eyebrow": "Видео о продукте",
  "video.title": "Полный сервис за две минуты.",
  "video.lead":
    "От сканирования QR до живого зала — как гости и персонал работают в одной системе.",
  "video.chrome": "QRMenu · обзор продукта",
  "video.shot1": "Гость сканирует",
  "video.shot2": "Зал обновляется",
  "video.shot3": "Кухня закрывает",
  "video.hint": "Здесь будет ваш ролик о продукте",
  "video.play": "Смотреть видео",
  "video.pause": "Пауза",
  "video.soon": "Видео скоро появится",
  "video.rail1": "Скан",
  "video.rail2": "Заказ",
  "video.rail3": "Зал",
  "video.rail4": "Кухня",
  "video.rail5": "Аналитика",

  // Products section
  "products.eyebrow": "Наши продукты",
  "products.title": "Для реальных моментов сервиса.",
  "products.lead": "Каждая возможность — так, как ею пользуются гости и персонал.",
  "products.details": "Подробнее",

  "product.online-menu.title": "Онлайн QR-меню",
  "product.online-menu.kicker": "Опыт гостя",
  "product.online-menu.p1": "Гости открывают ваше фирменное меню по QR-коду стола",
  "product.online-menu.p2": "Фото, категории и пометки о составе — удобно на телефоне",
  "product.online-menu.p3": "Живая доступность — мгновенно скрывайте закончившиеся позиции",
  "product.online-menu.p4": "Работает на любом телефоне, без установки приложения",

  "product.table-ordering.title": "QR-заказы за столом",
  "product.table-ordering.kicker": "Опыт гостя",
  "product.table-ordering.p1": "Гости собирают и отправляют заказ, не вставая со стола",
  "product.table-ordering.p2": "Понятные модификаторы, количество и итог до отправки",
  "product.table-ordering.p3": "Личный заказ сразу попадает к вашей команде",
  "product.table-ordering.p4": "Меньше ожидания персонала по каждому запросу",

  "product.order-receiving.title": "Приём заказов в реальном времени",
  "product.order-receiving.kicker": "Зал и кухня",
  "product.order-receiving.p1": "Новые заказы со столов появляются на экранах зала и кухни",
  "product.order-receiving.p2": "Статус от принятия до отдачи и закрытия",
  "product.order-receiving.p3": "Тикеты с привязкой к столу снижают ошибки передачи",
  "product.order-receiving.p4": "Ведите смену с телефона или планшета в пик",

  "product.menu-admin.title": "Управление меню вживую",
  "product.menu-admin.kicker": "Владелец и админ",
  "product.menu-admin.p1": "Владельцы обновляют цены и позиции в одной админке",
  "product.menu-admin.p2": "Опубликовали один раз — гостевые меню обновляются сами",
  "product.menu-admin.p3": "Скрывайте позиции посреди смены без перепечатки",
  "product.menu-admin.p4": "Роли дают персоналу и менеджерам нужный доступ",

  "product.staff-orders.title": "Ручные заказы персонала",
  "product.staff-orders.kicker": "Зал и персонал",
  "product.staff-orders.p1": "Официанты вводят заказы для гостей без QR",
  "product.staff-orders.p2": "Тот же живой поток тикетов, что и у гостевых заказов",
  "product.staff-orders.p3": "Привязка позиций к нужному столу за секунды",
  "product.staff-orders.p4": "Удобно для VIP, телефонных заказов и загруженных передач",

  "product.reservations.title": "Система бронирования",
  "product.reservations.kicker": "Хостес и владелец",
  "product.reservations.p1": "Принимайте и ведите брони рядом с живым сервисом",
  "product.reservations.p2": "Ясно видно количество гостей, время и столы",
  "product.reservations.p3": "Хостес синхронизированы с темпом кухни",
  "product.reservations.p4": "От спокойных вечеров до пиковых выходных",

  "product.feedback.title": "Отзывы гостей",
  "product.feedback.kicker": "Гость и владелец",
  "product.feedback.p1": "Собирайте оценки сразу после визита",
  "product.feedback.p2": "Комментарии — в одном входящем для команды",
  "product.feedback.p3": "Замечайте проблемы сервиса, пока они ещё актуальны",
  "product.feedback.p4": "Более ясная картина опыта гостей",

  // Ecosystem
  "eco.title": "Идеальная экосистема для ресторанов и отелей",
  "eco.lead":
    "Гибко настраивайте каждую функцию и инструмент QRMenu, чтобы повысить эффективность бизнеса.",
  "eco.restaurants.title": "Рестораны",
  "eco.restaurants.text":
    "Запустите фирменное QR-меню, принимайте заказы со столов и держите зал в синхроне от открытия до закрытия.",
  "eco.cafes.title": "Кафе",
  "eco.cafes.text":
    "Ускоряйте оборачиваемость живым меню, заказами к выдаче и понятными подсказками по среднему чеку.",
  "eco.bars.title": "Бары",
  "eco.bars.text":
    "Цифровые барные карты, QR-заказы за столом и отзывы гостей после каждого визита.",
  "eco.hotels.title": "Отели",
  "eco.hotels.text":
    "Заказы room-service, заметки гостей и меньше ошибок передачи между сменами.",
  "eco.chains.title": "Сети ресторанов и отелей",
  "eco.chains.text":
    "Единые меню, акции и стандарты сервиса во всех точках.",
  "eco.ghost.title": "Ghost kitchen",
  "eco.ghost.text":
    "Цифровые заказы, быстрые обновления меню и чистые данные клиентов в одной системе.",

  // Platform
  "platform.eyebrow": "Как это работает",
  "platform.title": "Где работает QRMenu",
  "platform.lede":
    "Мобильное приложение для зала. Веб для офиса. Онлайн-меню для гостей — и QR на каждом столе, который привязывает заказ к нужному месту.",
  "platform.table12": "Стол 12",

  "platform.mobile.kicker": "Команда · мобильное",
  "platform.mobile.title": "Приложение Android и iOS",
  "platform.mobile.text":
    "Живые тикеты, статус столов и ввод заказов персоналом с зала — нативные приложения для Android и iOS.",
  "platform.mobile.tag1": "Android",
  "platform.mobile.tag2": "iOS",

  "platform.admin.kicker": "Владелец · веб",
  "platform.admin.title": "Веб-приложение для ноутбуков",
  "platform.admin.text":
    "Меню, часы работы, роли и настройки сервиса в браузере — для управления с ноутбука и ПК.",
  "platform.admin.tag1": "Ноутбук",
  "platform.admin.tag2": "ПК",

  "platform.menu.kicker": "Гость · браузер",
  "platform.menu.title": "Онлайн-меню",
  "platform.menu.text":
    "Гости открывают фирменное меню на телефоне — смотрят, настраивают и отправляют на кухню без скачивания.",
  "platform.menu.tag1": "Без приложения",

  "platform.qr.kicker": "Зал · столы",
  "platform.qr.title": "QR с номерами столов",
  "platform.qr.text":
    "Один QR на стол. Гость сканирует, попадает на своё место, и каждый заказ остаётся привязан к этому номеру.",
  "platform.qr.tag1": "Печатная подставка",

  // Pricing
  "pricing.eyebrow": "Тарифы",
  "pricing.title": "Начните с QR-заказов. Добавьте то, что нужно.",
  "pricing.lead": "Выберите пакет — затем свяжитесь с нами, чтобы его активировать.",
  "pricing.monthly": "Ежемесячно",
  "pricing.yearly": "Ежегодно",
  "pricing.save": "Экономия ~20%",
  "pricing.perLocationMonth": "за точку / месяц",
  "pricing.billedYearly": ", оплата раз в год",
  "pricing.perYear": "{price} в год",
  "pricing.contactStart": "Свяжитесь с нами, чтобы начать",
  "pricing.choose": "Выбрать {name}",
  "pricing.mostPopular": "Самый популярный",
  "pricing.notePrefix": "После выбора пакета вы перейдёте в раздел ",
  "pricing.noteSuffix":
    " — Telegram, WhatsApp, звонок или email с готовым сообщением.",
  "pricing.includesGrow": "Всё из Ordering, плюс:",
  "pricing.includesOps": "Всё из Grow, плюс:",

  "plan.ordering.name": "Ordering",
  "plan.ordering.tagline": "QR-меню и онлайн-заказы",
  "plan.ordering.feat1": "Фирменные QR-коды для каждого стола",
  "plan.ordering.feat2": "Живое онлайн-меню для гостей",
  "plan.ordering.feat3": "Онлайн-заказы гостей со стола",
  "plan.ordering.feat4": "Фото, цены и модификаторы",
  "plan.ordering.feat5": "Мгновенные обновления меню (без перепечатки)",
  "plan.ordering.feat6": "Базовый входящий заказов для зала",
  "plan.ordering.no1": "Сайт и онлайн-бронирование",
  "plan.ordering.no2": "Ручные заказы персонала и POS-мост",

  "plan.grow.name": "Grow",
  "plan.grow.tagline": "Сайт и бронирование",
  "plan.grow.feat1": "Присутствие ресторана в интернете",
  "plan.grow.feat2": "Онлайн-бронирование столов",
  "plan.grow.feat3": "Входящие брони и управление статусом",
  "plan.grow.feat4": "Ссылка на бронирование для гостей",
  "plan.grow.feat5": "Меню + заказы + брони в одном месте",
  "plan.grow.no1": "Ручной ввод заказов персоналом",
  "plan.grow.no2": "POS-мост для команды зала",

  "plan.ops.name": "Ops",
  "plan.ops.tagline": "Заказы персонала и POS",
  "plan.ops.feat1": "Ручная отправка заказов персоналом",
  "plan.ops.feat2": "POS / мост-процессы для зала",
  "plan.ops.feat3": "Мобильное приложение для персонала (Android и iOS)",
  "plan.ops.feat4": "Веб-админка для владельцев и менеджеров",
  "plan.ops.feat5": "Живые тикеты с привязкой к номерам столов",
  "plan.ops.feat6": "Полное покрытие заказов гостей и персонала",

  // FAQ
  "faq.eyebrow": "FAQ",
  "faq.title": "Частые вопросы.",
  "faq.lead": "Короткие ответы. Если у вас особая схема — быстро разберём её вместе.",
  "faq.q1": "Это только для высокого трафика или fine dining?",
  "faq.a1": "Нет. Подходит для кафе, casual dining и полноценного обслуживания за столами.",
  "faq.q2": "Как выглядит внедрение для моей команды?",
  "faq.a2": "Мы проводим структурированную настройку меню, ролей и онбординг команды.",
  "faq.q3": "Как вы работаете с изменениями после запуска?",
  "faq.a3": "Вы можете обновлять позиции меню, цены и правила сервиса в любой момент.",
  "faq.q4": "Работаете ли вы с несколькими точками?",
  "faq.a4": "Да. Общие стандарты по сети с локальной гибкостью там, где нужно.",
  "faq.q5": "Можно ли сменить тариф после запуска?",
  "faq.a5":
    "Да. Команды часто начинают с малого и переходят выше по мере роста точек и интеграций.",
  "seo.title": "QRMenu — QR-меню, заказы со стола и управление рестораном",
  "seo.description":
    "QR-меню и онлайн-заказы для ресторанов в Узбекистане. Гости сканируют код стола, заказывают и бронируют. Команда ведёт зал в одной системе.",
  "seo.skip": "К содержанию",

  // Contact
  "contact.eyebrow": "Контакты",
  "contact.title": "Свяжитесь с нами",
  "contact.lead":
    "Telegram, WhatsApp, телефон или email — мы ответим и поможем начать.",
  "contact.selectedPackage": "Выбранный пакет",
  "contact.yearly": "Ежегодно",
  "contact.monthly": "Ежемесячно",
  "contact.includedHint": "Уже включено в сообщение для Telegram, WhatsApp и email.",
  "contact.clear": "Сбросить",
  "contact.call": "Звонок",
  "contact.telegram": "Telegram",
  "contact.whatsapp": "WhatsApp",
  "contact.email": "Email",
  "contact.msg.general":
    "Здравствуйте! Хочу узнать больше о QRMenu для моего ресторана. Пожалуйста, свяжитесь со мной.",
  "contact.msg.interest":
    "Здравствуйте! Меня интересует пакет QRMenu {plan} ({cycle}). {price} Пожалуйста, свяжитесь со мной, чтобы начать.",
  "contact.msg.priceMonthly": "Указанная цена: {price} so'm/мес.",
  "contact.msg.priceYearly": "Указанная цена: {price} so'm/мес при годовой оплате.",
  "contact.subject.general": "QRMenu — запрос информации",
  "contact.subject.plan": "QRMenu — {plan} ({billing})",

  // Footer
  "footer.blurb":
    "Цифровые меню, заказы и прозрачность бэк-офиса для ресторанов с обслуживанием за столами.",
  "footer.product": "Продукт",
  "footer.contact": "Контакты",
  "footer.company": "Компания",
  "footer.messageUs": "Написать нам",
  "footer.choosePackage": "Выбрать пакет",
  "footer.about": "О нас",
  "footer.whoFor": "Для кого",
  "footer.privacy": "Политика конфиденциальности",
  "footer.rights": "Все права защищены.",
};

const uz = {
  // Nav
  "nav.demo": "Demo",
  "nav.products": "Mahsulotlar",
  "nav.platform": "Platforma",
  "nav.pricing": "Narxlar",
  "nav.contact": "Aloqa",
  "nav.faq": "FAQ",
  "nav.openMenu": "Menyuni ochish",
  "nav.closeMenu": "Menyuni yopish",
  "nav.contactCta": "Bog'lanish",

  // Hero
  "hero.title": "Zalingiz — har bir ekranda jonli.",
  "hero.lead":
    "Mehmonlar telefonidan buyurtma beradi. Xodimlar planshetda zalni boshqaradi. Egalar hammasi desktopda ko'radi.",
  "hero.ctaWalkthrough": "Demo uchrashuvni belgilash",
  "hero.ctaWatch": "Mahsulotni ko'rish",
  "hero.stageAria": "Mahsulot telefon va planshetda",
  "hero.altLaptop": "Noutbukdagi QRMenu admin paneli",
  "hero.altTablet": "Planshetdagi jonli zal doskasi",
  "hero.altPhone": "Telefondagi mehmon menyusi",

  // Video
  "video.eyebrow": "Mahsulot filmi",
  "video.title": "To'liq xizmatni ikki daqiqada ko'ring.",
  "video.lead":
    "QR skandan jonli zalgacha — mehmonlar va xodimlar bitta tizimda qanday ishlashini kuzating.",
  "video.chrome": "QRMenu · mahsulot turu",
  "video.shot1": "Mehmon skan qiladi",
  "video.shot2": "Zal yangilanadi",
  "video.shot3": "Oshxona yopadi",
  "video.hint": "Mahsulot filmingiz shu yerda o'ynaydi",
  "video.play": "Mahsulot videosini ko'rish",
  "video.pause": "Videoni pauza qilish",
  "video.soon": "Video tez orada",
  "video.rail1": "Skan",
  "video.rail2": "Buyurtma",
  "video.rail3": "Zal",
  "video.rail4": "Oshxona",
  "video.rail5": "Tahlil",

  // Products section
  "products.eyebrow": "Mahsulotlarimiz",
  "products.title": "Haqiqiy xizmat lahzalari uchun.",
  "products.lead": "Har bir imkoniyat — mehmonlar va xodimlar haqiqatan qanday foydalansa, shunday ko'rsatilgan.",
  "products.details": "Batafsil",

  "product.online-menu.title": "Onlayn QR menyu",
  "product.online-menu.kicker": "Mehmon tajribasi",
  "product.online-menu.p1": "Mehmonlar stol QR kodidan brendingizdagi menyuni ochadi",
  "product.online-menu.p2": "Foto, kategoriyalar va dietik izohlar — mobil uchun mos",
  "product.online-menu.p3": "Jonli mavjudlik — tugagan taomlarni darhol yashiring",
  "product.online-menu.p4": "Har qanday telefonda ishlaydi, ilova o'rnatish shart emas",

  "product.table-ordering.title": "Stolga QR buyurtmalar",
  "product.table-ordering.kicker": "Mehmon tajribasi",
  "product.table-ordering.p1": "Mehmonlar o'z o'rnidan buyurtma yig'adi va yuboradi",
  "product.table-ordering.p2": "Yuborishdan oldin aniq modifierlar, miqdor va jami",
  "product.table-ordering.p3": "Shaxsiy buyurtma to'g'ridan-to'g'ri jamoangizga boradi",
  "product.table-ordering.p4": "Har bir so'rov uchun xodimlarni kutish kamayadi",

  "product.order-receiving.title": "Jonli buyurtma qabul qilish",
  "product.order-receiving.kicker": "Zal va oshxona",
  "product.order-receiving.p1": "Yangi stol buyurtmalari zal va oshxona ekranlarida paydo bo'ladi",
  "product.order-receiving.p2": "Holatni qabuldan berishgacha va yopishgacha kuzating",
  "product.order-receiving.p3": "Stolga bog'langan ticketlar uzatish xatolarini kamaytiradi",
  "product.order-receiving.p4": "Rush paytida telefon yoki planshetdan xizmatni boshqaring",

  "product.menu-admin.title": "Jonli menyu boshqaruvi",
  "product.menu-admin.kicker": "Egasi va admin",
  "product.menu-admin.p1": "Egalar narx va pozitsiyalarni bitta adminda yangilaydi",
  "product.menu-admin.p2": "Bir marta nashr qiling — mehmon menyulari avtomatik yangilanadi",
  "product.menu-admin.p3": "Smena o'rtasida qayta chop etmasdan pozitsiyalarni yashiring",
  "product.menu-admin.p4": "Rollar xodim va menejerlarga to'g'ri kirishni beradi",

  "product.staff-orders.title": "Xodimlar qo'lda buyurtmalari",
  "product.staff-orders.kicker": "Zal va xodimlar",
  "product.staff-orders.p1": "Ofitsiantlar QR ishlatmagan mehmonlar uchun buyurtma kiritadi",
  "product.staff-orders.p2": "Mehmon yuborgan buyurtmalar bilan bir xil jonli ticket oqimi",
  "product.staff-orders.p3": "Pozitsiyalarni kerakli stolga soniyalarda bog'lang",
  "product.staff-orders.p4": "VIP stollar, telefon buyurtmalari yoki band uzatishlar uchun ideal",

  "product.reservations.title": "Bron tizimi",
  "product.reservations.kicker": "Hostess va egasi",
  "product.reservations.p1": "Jonli xizmat yonida bronlarni qabul qiling va boshqaring",
  "product.reservations.p2": "Mehmon soni, vaqt va stol taqsimotini aniq ko'ring",
  "product.reservations.p3": "Hostesslarni oshxona ritmi bilan moslashtiring",
  "product.reservations.p4": "Sokin kechalardan pik dam olish kunlarigacha masshtablang",

  "product.feedback.title": "Mehmon fikr-mulohazasi",
  "product.feedback.kicker": "Mehmon va egasi",
  "product.feedback.p1": "Baholarni ovqatdan so'ng darhol yig'ing",
  "product.feedback.p2": "Izohlarni jamoa uchun bitta inboxda ko'ring",
  "product.feedback.p3": "Xizmat muammolarini hali foydali bo'lganda aniqlang",
  "product.feedback.p4": "Mehmon tajribasi haqida aniqroq tasavvur yarating",

  // Ecosystem
  "eco.title": "Restoranlar va mehmonxonalar uchun mukammal ekotizim",
  "eco.lead":
    "Biznesingiz samaradorligini oshirish uchun har bir QRMenu funksiyasi va vositasini moslashuvchan sozlang.",
  "eco.restaurants.title": "Restoranlar",
  "eco.restaurants.text":
    "Brendlangan QR menyuni ishga tushiring, stol buyurtmalarini qabul qiling va zalni ochilishdan yopilishgacha sinxron saqlang.",
  "eco.cafes.title": "Kafelar",
  "eco.cafes.text":
    "Jonli menyu, olishga tayyor buyurtmalar va aniqroq o'rtacha chek maslahatlari bilan aylanishni tezlashtiring.",
  "eco.bars.title": "Barlar",
  "eco.bars.text":
    "Raqamli ichimliklar ro'yxati, stol yonida QR buyurtma va har tashrifdan keyin mehmon fikri.",
  "eco.hotels.title": "Mehmonxonalar",
  "eco.hotels.text":
    "Xona xizmati buyurtmalari, mehmon izohlari va smenalar o'rtasida kamroq uzatish xatolari.",
  "eco.chains.title": "Restoran va mehmonxona tarmoqlari",
  "eco.chains.text":
    "Menyu, aksiyalar va xizmat standartlarini har bir filiala moslab saqlang.",
  "eco.ghost.title": "Ghost kitchen",
  "eco.ghost.text":
    "Raqamli buyurtmalar, tez menyu yangilanishlari va toza mijoz ma'lumotlarini bitta tizimdan boshqaring.",

  // Platform
  "platform.eyebrow": "Qanday ishlaydi",
  "platform.title": "QRMenu qayerda ishlaydi",
  "platform.lede":
    "Zal uchun mobil. Ofis uchun veb. Mehmonlar uchun onlayn menyu — va har bir stolda buyurtmani to'g'ri o'ringa bog'laydigan QR.",
  "platform.table12": "Stol 12",

  "platform.mobile.kicker": "Jamoa · mobil",
  "platform.mobile.title": "Android va iOS ilovasi",
  "platform.mobile.text":
    "Jonli ticketlar, stol holati va xodim buyurtma kiritish — Android va iOS uchun mahalliy ilovalar.",
  "platform.mobile.tag1": "Android",
  "platform.mobile.tag2": "iOS",

  "platform.admin.kicker": "Egasi · veb",
  "platform.admin.title": "Noutbuklar uchun veb-ilova",
  "platform.admin.text":
    "Menyu, ish soatlari, rollar va xizmat sozlamalari brauzerda — noutbuk va desktop boshqaruvi uchun.",
  "platform.admin.tag1": "Noutbuk",
  "platform.admin.tag2": "Desktop",

  "platform.menu.kicker": "Mehmon · brauzer",
  "platform.menu.title": "Onlayn menyu",
  "platform.menu.text":
    "Mehmonlar telefonda brendlangan menyuni ochadi — ko'radi, sozlaydi va yuklab olmasdan oshxonaga yuboradi.",
  "platform.menu.tag1": "Ilova kerak emas",

  "platform.qr.kicker": "Zal · stollar",
  "platform.qr.title": "QR stol raqamlari",
  "platform.qr.text":
    "Har bir stol uchun bitta QR. Mehmon skan qiladi, to'g'ri o'ringa tushadi va har bir buyurtma shu raqamga bog'lanadi.",
  "platform.qr.tag1": "Chop etilgan stend",

  // Pricing
  "pricing.eyebrow": "Narxlar",
  "pricing.title": "QR buyurtmalardan boshlang. Keragini qo'shing.",
  "pricing.lead": "Paketni tanlang — keyin faollashtirish uchun biz bilan bog'laning.",
  "pricing.monthly": "Oylik",
  "pricing.yearly": "Yillik",
  "pricing.save": "Tejam ~20%",
  "pricing.perLocationMonth": "har bir filial / oy",
  "pricing.billedYearly": ", yillik to'lov",
  "pricing.perYear": "{price} yiliga",
  "pricing.contactStart": "Boshlash uchun biz bilan bog'laning",
  "pricing.choose": "{name} ni tanlash",
  "pricing.mostPopular": "Eng mashhur",
  "pricing.notePrefix": "Paketni tanlaganingizdan so'ng ",
  "pricing.noteSuffix":
    " bo'limiga o'tasiz — Telegram, WhatsApp, telefon yoki email tayyor xabar bilan.",
  "pricing.includesGrow": "Ordering dagi hammasi, qo'shimcha:",
  "pricing.includesOps": "Grow dagi hammasi, qo'shimcha:",

  "plan.ordering.name": "Ordering",
  "plan.ordering.tagline": "QR menyu va onlayn buyurtmalar",
  "plan.ordering.feat1": "Har bir stol uchun brendlangan QR kodlar",
  "plan.ordering.feat2": "Jonli onlayn mehmon menyusi",
  "plan.ordering.feat3": "Stoldan mehmon onlayn buyurtmasi",
  "plan.ordering.feat4": "Foto, narxlar va modifierlar",
  "plan.ordering.feat5": "Darhol menyu yangilanishlari (qayta chop etishsiz)",
  "plan.ordering.feat6": "Zal uchun asosiy buyurtma inboxi",
  "plan.ordering.no1": "Veb-sayt va onlayn bron",
  "plan.ordering.no2": "Xodimlar qo'lda buyurtmalari va POS bridge",

  "plan.grow.name": "Grow",
  "plan.grow.tagline": "Veb-sayt va bronlar",
  "plan.grow.feat1": "Restoran veb-mavjudligi",
  "plan.grow.feat2": "Onlayn stol bronlari",
  "plan.grow.feat3": "Bron inboxi va holat boshqaruvi",
  "plan.grow.feat4": "Mehmonlar uchun ulashiladigan bron havolasi",
  "plan.grow.feat5": "Menyu + buyurtmalar + bronlar bir joyda",
  "plan.grow.no1": "Xodimlar qo'lda buyurtma kiritishi",
  "plan.grow.no2": "Zal jamoasi uchun POS bridge",

  "plan.ops.name": "Ops",
  "plan.ops.tagline": "Xodim buyurtmalari va POS",
  "plan.ops.feat1": "Xodimlar uchun qo'lda buyurtma yuborish",
  "plan.ops.feat2": "Zal uchun POS / bridge jarayonlari",
  "plan.ops.feat3": "Xodimlar mobil ilovasi (Android va iOS)",
  "plan.ops.feat4": "Egalar va menejerlar uchun veb-admin",
  "plan.ops.feat5": "Stol raqamlariga bog'langan jonli ticketlar",
  "plan.ops.feat6": "Mehmon + xodim buyurtmalarining to'liq qamrovi",

  // FAQ
  "faq.eyebrow": "FAQ",
  "faq.title": "Ko'p so'raladigan savollar.",
  "faq.lead": "Qisqa javoblar. Maxsus sozlamangiz bo'lsa, tezda ko'rib chiqamiz.",
  "faq.q1": "Bu faqat yuqori oqim yoki fine dining uchunmi?",
  "faq.a1": "Yo'q. Kafelar, casual dining va to'liq stol xizmati jamoalari uchun mos.",
  "faq.q2": "Jamoam uchun joriy etish qanday ko'rinadi?",
  "faq.a2": "Menyu, rollar va jamoa onboardingi uchun tuzilgan sozlashni o'tkazamiz.",
  "faq.q3": "Ishga tushgandan keyin o'zgarishlarni qanday boshqarasiz?",
  "faq.a3": "Menyu pozitsiyalari, narxlar va xizmat qoidalarini istalgan vaqtda yangilashingiz mumkin.",
  "faq.q4": "Bir nechta filial bilan ishlaysizmi?",
  "faq.a4": "Ha. Kerak bo'lganda mahalliy moslashuv bilan filiallar bo'ylab umumiy standartlar.",
  "faq.q5": "Ishga tushgandan keyin tarifni o'zgartirish mumkinmi?",
  "faq.a5":
    "Ha. Jamoalar ko'pincha kichikdan boshlaydi va filial yoki integratsiyalar qo'shilganda yuqoriroq tarifga o'tadi.",
  "seo.title": "QRMenu — QR menyu, stol buyurtmalari va restoran boshqaruvi",
  "seo.description":
    "O‘zbekiston restoranlari uchun QR menyu va onlayn buyurtma. Mehmonlar stol kodini skanerlaydi, buyurtma beradi va bron qiladi. Jamoa zalni bitta tizimda boshqaradi.",
  "seo.skip": "Tarkibga o‘tish",

  // Contact
  "contact.eyebrow": "Aloqa",
  "contact.title": "Biz bilan bog'laning",
  "contact.lead":
    "Telegram, WhatsApp, telefon yoki email — javob beramiz va boshlashga yordam beramiz.",
  "contact.selectedPackage": "Tanlangan paket",
  "contact.yearly": "Yillik",
  "contact.monthly": "Oylik",
  "contact.includedHint": "Telegram, WhatsApp va email xabaringizga kiritilgan.",
  "contact.clear": "Tozalash",
  "contact.call": "Qo'ng'iroq",
  "contact.telegram": "Telegram",
  "contact.whatsapp": "WhatsApp",
  "contact.email": "Email",
  "contact.msg.general":
    "Salom! Restoranim uchun QRMenu haqida ko'proq bilmoqchiman. Iltimos, men bilan bog'laning.",
  "contact.msg.interest":
    "Salom! QRMenu {plan} paketiga ({cycle}) qiziqaman. {price} Boshlash uchun iltimos men bilan bog'laning.",
  "contact.msg.priceMonthly": "Ko'rsatilgan narx: {price} so'm/oy.",
  "contact.msg.priceYearly": "Ko'rsatilgan narx: {price} so'm/oy, yillik to'lov.",
  "contact.subject.general": "QRMenu — ma'lumot so'rovi",
  "contact.subject.plan": "QRMenu — {plan} ({billing})",

  // Footer
  "footer.blurb":
    "Stol xizmati restoranlari uchun raqamli menyular, buyurtmalar va back-of-house aniqlik.",
  "footer.product": "Mahsulot",
  "footer.contact": "Aloqa",
  "footer.company": "Kompaniya",
  "footer.messageUs": "Bizga yozing",
  "footer.choosePackage": "Paket tanlash",
  "footer.about": "Biz haqimizda",
  "footer.whoFor": "Kimlar uchun",
  "footer.privacy": "Maxfiylik siyosati",
  "footer.rights": "Barcha huquqlar himoyalangan.",
};

export const translations = { en, ru, uz };
