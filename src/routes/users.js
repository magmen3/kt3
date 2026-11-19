// =====================================================================
// ФАЙЛ: src/routes/users.js — МАРШРУТЫ ПОЛЬЗОВАТЕЛЕЙ
// ---------------------------------------------------------------------
// Подключается в src/index.js: app.use('/api/users', usersRouter)
//
//   GET    /api/users       список с пагинацией
//   GET    /api/users/:id   пользователь вместе с его постами
//   POST   /api/users       создать
//   PATCH  /api/users/:id   обновить
//   DELETE /api/users/:id   удалить
//
// Все обработчики async: запросы к базе занимают время, мы ждём их через await.
// Если Prisma выбросит ошибку — Express 5 сам передаст её в errorHandler.
// =====================================================================

const express = require('express')
const Joi = require('joi')
const prisma = require('../db')                                     // src/db.js
const { validate, validateId } = require('../middleware/validate')  // src/middleware/validate.js

const router = express.Router()

// Роли — те же, что в enum Role в prisma/schema.prisma
const roles = ['USER', 'ADMIN']

// ---- Схемы валидации ----

// Query для списка: ?page=2&limit=5. Не прислали — page=1, limit=10
const usersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
})

// Создание: email и name обязательны, role — по желанию (иначе база поставит USER)
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid(...roles)
})

// Обновление: всё необязательно, но хотя бы одно поле (.min(1))
const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  name: Joi.string().min(2).max(100),
  role: Joi.string().valid(...roles)
}).min(1)


// GET /api/users — список с пагинацией
router.get('/', validate(usersQuerySchema, 'query'), async (req, res) => {
  const { page, limit } = req.validated

  // findMany — найти много записей.
  //   skip — сколько пропустить (страница 2 по 10 -> пропустить 10)
  //   take — сколько взять
  //   orderBy — сортировка, иначе порядок не гарантирован
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    skip: (page - 1) * limit,
    take: limit
  })

  // count — сколько всего пользователей (для meta.total и meta.pages)
  const total = await prisma.user.count()

  // pages — сколько всего страниц: 25 записей по 10 -> Math.ceil(2.5) = 3
  res.json({
    data: users,
    meta: { total, page, limit, pages: Math.ceil(total / limit) }
  })
})

// GET /api/users/:id — пользователь вместе с постами
router.get('/:id', validateId, async (req, res) => {
  // findUnique — найти одну запись по уникальному полю (id или email)
  // include — «подтянуть связанные данные»: Prisma сама сделает JOIN
  //   posts: { orderBy: { createdAt: 'desc' } } — посты от новых к старым (требование задания)
  const user = await prisma.user.findUnique({
    where: { id: req.id },
    include: {
      posts: { orderBy: { createdAt: 'desc' } }
    }
  })

  // findUnique возвращает null, если не нашёл — отвечаем 404 сами
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' })
  }

  res.json({ data: user })
})

// POST /api/users — создать. Если email уже занят — Prisma выбросит P2002 -> errorHandler -> 409
router.post('/', validate(createUserSchema), async (req, res) => {
  const user = await prisma.user.create({ data: req.validated })
  res.status(201).json({ data: user })
})

// PATCH /api/users/:id — обновить только присланные поля.
// Если такого id нет — Prisma выбросит P2025 -> errorHandler -> 404
router.patch('/:id', validateId, validate(updateUserSchema), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.id },
    data: req.validated
  })
  res.json({ data: user })
})

// DELETE /api/users/:id — удалить.
// Нет такого id -> P2025 -> 404.
// У пользователя есть посты -> база не даст удалить (внешний ключ) -> P2003 -> 409
router.delete('/:id', validateId, async (req, res) => {
  await prisma.user.delete({ where: { id: req.id } })
  res.status(204).send()
})

module.exports = router
