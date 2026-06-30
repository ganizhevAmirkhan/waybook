# WayBook — Г1алг1ай библиотека

Ингушская цифровая библиотека (PWA + десктоп).

## Запуск локально

```bash
cd C:\waybook
npx --yes serve -l 3088
```

Откройте: http://localhost:3088

> Порт 3080 может быть занят другим приложением (Abat PDF). WayBook использует **3088**.

Установка на ПК/телефон: в Chrome → «Установить WayBook».

## Разделы

- `books/skazki` — сказки
- `books/literature` — литература (Ашик-Кериб)
- `books/religion` — религия
- `books/grammar` — грамматика
- `books/other` — другое

## Добавить книгу

1. Положить `book.txt` (формат: `Стр. 1` на отдельной строке, затем текст).
2. Положить `ashik-kerib.doc` (и `.pdf` при наличии).
3. Создать `meta.json` в папке книги.
4. `node scripts/import-book.js <раздел> <id> <путь-к-book.txt>`
5. Добавить запись в `data/catalog.json`.

## Иконки

`node scripts/generate-icons.js` — пересоздать PNG из `icons/icon.svg`.
