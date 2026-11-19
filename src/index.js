// =====================================================================
// ФАЙЛ: src/index.js — ТОЧКА ВХОДА
// ---------------------------------------------------------------------
// Запуск: npm start (перед этим база должна работать: npm run db:up)
//
// Порядок прохождения запроса:
//   logger -> express.json -> /api/users или /api/posts -> 404 -> errorHandler
// =====================================================================

const express = require('express')
const config = require('./config')                         // src/config/index.js
const logger = require('./middleware/logger')              // src/middleware/logger.js
const errorHandler = require('./middleware/errorHandler')  // src/middleware/errorHandler.js
const usersRouter = require('./routes/users')              // src/routes/users.js
const postsRouter = require('./routes/posts')              // src/routes/posts.js

const app = express()

// Логгер первым — видит все запросы
app.use(logger)

// Разбирает JSON из тела запроса в req.body
app.use(express.json())

// Подключаем роутеры под префиксами.
// router.get('/') в users.js = GET /api/users, router.get('/:id') = GET /api/users/:id
app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)

// Никто не ответил — такого маршрута нет
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' })
})

// Обработчик ошибок — строго последним
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Сервер запущен: http://localhost:${config.port}`)
})
