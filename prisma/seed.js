// =====================================================================
// ФАЙЛ: prisma/seed.js — ТЕСТОВЫЕ ДАННЫЕ
// ---------------------------------------------------------------------
// Очищает базу и заполняет её примерами, чтобы было что показать.
// Запуск: npm run seed  (это вызывает prisma db seed, а та — node prisma/seed.js;
//                        связь прописана в package.json в разделе "prisma")
// Не обязателен по заданию — просто удобство для демонстрации.
// =====================================================================

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Удаляем старые данные. Порядок важен: сначала посты (они ссылаются на пользователей),
  // иначе база не даст удалить пользователей
  await prisma.post.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()

  // Два пользователя: Alice — админ, Bob — обычный
  const alice = await prisma.user.create({
    data: { email: 'alice@example.com', name: 'Alice', role: 'ADMIN' }
  })

  const bob = await prisma.user.create({
    data: { email: 'bob@example.com', name: 'Bob' }
  })

  // Три поста: два опубликованных у Alice с тегами, один черновик у Bob
  await prisma.post.create({
    data: {
      title: 'Знакомство с Node.js',
      content: 'Node.js — среда выполнения JavaScript на сервере.',
      published: true,
      authorId: alice.id,
      tags: { connectOrCreate: [{ where: { name: 'nodejs' }, create: { name: 'nodejs' } }] }
    }
  })

  await prisma.post.create({
    data: {
      title: 'Prisma и PostgreSQL',
      content: 'Как подключить базу данных через Prisma.',
      published: true,
      authorId: alice.id,
      tags: {
        connectOrCreate: [
          // nodejs уже создан выше — тут он просто привяжется
          { where: { name: 'nodejs' }, create: { name: 'nodejs' } },
          { where: { name: 'prisma' }, create: { name: 'prisma' } }
        ]
      }
    }
  })

  await prisma.post.create({
    data: {
      title: 'Черновик про Express',
      content: 'Пока не дописан.',
      published: false,
      authorId: bob.id
    }
  })

  console.log('Тестовые данные добавлены: 2 пользователя, 3 поста')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  // $disconnect — закрыть соединение с базой, иначе скрипт не завершится
  .finally(() => prisma.$disconnect())
