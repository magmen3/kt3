// =====================================================================
// ФАЙЛ: src/middleware/validate.js — ПРОВЕРКА ВХОДНЫХ ДАННЫХ
// ---------------------------------------------------------------------
// Два middleware:
//   validate(schema, source) — проверка тела запроса или query через Joi
//   validateId               — проверка, что :id в адресе — нормальное число
// Используются в src/routes/users.js и src/routes/posts.js:
//   const { validate, validateId } = require('../middleware/validate')
// =====================================================================

// validate — «фабрика»: принимает схему Joi и возвращает middleware.
// source: 'body' (по умолчанию) — тело запроса, 'query' — параметры после ? в адресе
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,  // собрать все ошибки сразу
      stripUnknown: true, // выбросить поля, которых нет в схеме (защита от лишних данных)
      convert: true       // привести типы: '2' -> 2, 'true' -> true
    })

    if (error) {
      // Превращаем ошибки Joi в простой массив { field, message }
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }))

      return res.status(400).json({ error: 'Ошибка валидации', details })
    }

    // Проверенные и очищенные данные — маршрут возьмёт их отсюда
    req.validated = value
    next()
  }
}

// Проверяет :id из адреса (/api/users/5 -> '5').
// Без этой проверки запрос /api/users/abc дошёл бы до Prisma,
// та получила бы NaN и упала с ошибкой 500. А так клиент получает понятный 400.
function validateId(req, res, next) {
  const id = Number(req.params.id)

  // Number.isInteger — целое ли число (NaN, 1.5 -> false)
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'id должен быть положительным целым числом' })
  }

  // Кладём готовое число в req.id — маршруты используют его в where: { id: req.id }
  req.id = id
  next()
}

// Экспортируем объект с двумя функциями
module.exports = { validate, validateId }
