// =====================================================================
// ФАЙЛ: src/routes/posts.js — МАРШРУТЫ ПОСТОВ
// ---------------------------------------------------------------------
// Подключается в src/index.js: app.use('/api/posts', postsRouter)
//
//   GET    /api/posts       список: поиск, фильтры, пагинация
//   GET    /api/posts/:id   пост с автором и тегами
//   POST   /api/posts       создать (теги через connectOrCreate)
//   PATCH  /api/posts/:id   обновить
//   DELETE /api/posts/:id   удалить
// =====================================================================

const express = require('express')
const Joi = require('joi')
const prisma = require('../db')
const { validate, validateId } = require('../middleware/validate')

const router = express.Router()

// ---- Схемы валидации ----

// Query для списка: /api/posts?search=prisma&published=true&authorId=1&page=1&limit=10
const postsQuerySchema = Joi.object({
  search: Joi.string().trim().min(1),            // текст для поиска в заголовке
  published: Joi.boolean(),                      // 'true'/'false' из адреса -> true/false
  authorId: Joi.number().integer().min(1),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
})

// Теги — массив строк без повторов: ['nodejs', 'prisma']
const tagsSchema = Joi.array().items(Joi.string().trim().min(1).max(50)).unique()

// Создание поста. По заданию: title обязателен, authorId обязателен и числовой
const createPostSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  content: Joi.string().allow('', null),         // можно пустую строку или null — в схеме content String?
  published: Joi.boolean().default(false),
  authorId: Joi.number().integer().min(1).required(),
  tags: tagsSchema.default([])                   // не прислали теги — пустой массив
})

// Обновление: authorId менять нельзя (пост не «переезжает» к другому автору)
const updatePostSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  content: Joi.string().allow('', null),
  published: Joi.boolean(),
  tags: tagsSchema
}).min(1)

// Что подтягивать вместе с постом. Вынесено в переменную, потому что нужно в 4 местах.
// select у автора — берём только id, name, email (без лишних полей)
const includeAuthorAndTags = {
  author: { select: { id: true, name: true, email: true } },
  tags: true
}

// Превращает ['nodejs', 'new-tag'] в формат, который понимает Prisma:
//   [{ where: { name: 'nodejs' }, create: { name: 'nodejs' } }, ...]
// connectOrCreate для каждого тега: «найди тег с таким name и привяжи;
// если такого нет — создай и привяжи». Поэтому теги не дублируются.
function tagsToConnectOrCreate(tagNames) {
  return tagNames.map((name) => ({
    where: { name: name },
    create: { name: name }
  }))
}


// GET /api/posts — список с поиском, фильтрами и пагинацией
router.get('/', validate(postsQuerySchema, 'query'), async (req, res) => {
  const { search, published, authorId, page, limit } = req.validated

  // Собираем условие where постепенно — добавляем только присланные фильтры
  const where = {}

  if (search !== undefined) {
    // contains — «заголовок содержит текст» (SQL: ILIKE '%текст%')
    // mode: 'insensitive' — без учёта регистра: 'PRISMA' найдёт 'Prisma'
    where.title = { contains: search, mode: 'insensitive' }
  }

  if (published !== undefined) {
    where.published = published
  }

  if (authorId !== undefined) {
    where.authorId = authorId
  }

  const posts = await prisma.post.findMany({
    where: where,
    include: includeAuthorAndTags,
    orderBy: { createdAt: 'desc' },   // новые сверху
    skip: (page - 1) * limit,
    take: limit
  })

  // total считаем с тем же where — сколько ВСЕГО постов подходит под фильтры
  const total = await prisma.post.count({ where: where })

  // Формат ответа по заданию: data + meta (total, page, limit, pages)
  res.json({
    data: posts,
    meta: { total, page, limit, pages: Math.ceil(total / limit) }
  })
})

// GET /api/posts/:id — один пост с автором и тегами
router.get('/:id', validateId, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.id },
    include: includeAuthorAndTags
  })

  if (!post) {
    return res.status(404).json({ error: 'Пост не найден' })
  }

  res.json({ data: post })
})

// POST /api/posts — создать пост
router.post('/', validate(createPostSchema), async (req, res) => {
  const { title, content, published, authorId, tags } = req.validated

  // Сначала проверяем, что автор существует — чтобы дать понятную ошибку,
  // а не общую «нарушение связи» от базы
  const author = await prisma.user.findUnique({ where: { id: authorId } })

  if (!author) {
    return res.status(400).json({ error: `Автор с id ${authorId} не найден` })
  }

  const post = await prisma.post.create({
    data: {
      title: title,
      content: content,
      published: published,
      authorId: authorId,
      // Теги через connectOrCreate — требование задания
      tags: { connectOrCreate: tagsToConnectOrCreate(tags) }
    },
    include: includeAuthorAndTags
  })

  res.status(201).json({ data: post })
})

// PATCH /api/posts/:id — обновить пост
router.patch('/:id', validateId, validate(updatePostSchema), async (req, res) => {
  const { title, content, published, tags } = req.validated

  // Поля, которых нет в запросе, будут undefined — Prisma их просто не трогает
  const data = { title, content, published }

  // Если прислали теги — ЗАМЕНЯЕМ набор тегов:
  //   set: [] — отвязать все старые теги
  //   connectOrCreate — привязать новые (создав недостающие)
  if (tags !== undefined) {
    data.tags = {
      set: [],
      connectOrCreate: tagsToConnectOrCreate(tags)
    }
  }

  // Нет такого поста -> P2025 -> errorHandler -> 404
  const post = await prisma.post.update({
    where: { id: req.id },
    data: data,
    include: includeAuthorAndTags
  })

  res.json({ data: post })
})

// DELETE /api/posts/:id — удалить пост. Связи с тегами Prisma удалит сама,
// сами теги останутся (они могут быть у других постов)
router.delete('/:id', validateId, async (req, res) => {
  await prisma.post.delete({ where: { id: req.id } })
  res.status(204).send()
})

module.exports = router
