// =====================================================================
// ФАЙЛ: src/db.js — ПОДКЛЮЧЕНИЕ К БАЗЕ
// ---------------------------------------------------------------------
// Создаёт ОДИН объект prisma на всё приложение.
// Используется в src/routes/users.js и src/routes/posts.js: const prisma = require('../db')
//
// Почему один: каждый new PrismaClient() открывает свой набор соединений с базой.
// Если создавать его в каждом файле, соединения быстро кончатся.
// А require() в Node.js кэширует модуль — все файлы получают один и тот же объект.
// =====================================================================

// PrismaClient сгенерирован по schema.prisma (команда prisma migrate dev / prisma generate).
// Поэтому у него есть prisma.user, prisma.post, prisma.tag — по моделям из схемы.
const { PrismaClient } = require('@prisma/client')

// Адрес базы клиент сам берёт из переменной DATABASE_URL (из .env)
const prisma = new PrismaClient()

module.exports = prisma
