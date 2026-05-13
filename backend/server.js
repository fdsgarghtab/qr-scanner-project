const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { google } = require('googleapis')

const app = express()

app.use(cors())
app.use(bodyParser.json())

const PORT = process.env.PORT || 3001

// ================= GOOGLE =================
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({
  version: 'v4',
  auth,
})

const spreadsheetId = '1UjVFuNYTraeIit0JHD6YFwJ5DNI2xj_DedSdZXUGPs8'

const sheetName = 'Лист1'
const unknownSheet = 'Не найденные'

// ================= HELPERS =================

// Получаем сегодняшнюю дату по времени Владивостока
function getTodayColumnName() {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Vladivostok',
    day: '2-digit',
    month: '2-digit',
  })

  const parts = formatter.formatToParts(now)

  const day = parts.find(p => p.type === 'day').value
  const month = parts.find(p => p.type === 'month').value

  return `${day}.${month}`
}

// Нормализуем дату из Google Sheets
// Например:
// 14.05.2026 -> 14.05
// 14.5 -> 14.05
function normalizeDate(value) {
  if (!value) return ''

  const str = value.toString().trim()

  const parts = str.split('.')

  if (parts.length < 2) return str

  const day = String(parseInt(parts[0], 10)).padStart(2, '0')
  const month = String(parseInt(parts[1], 10)).padStart(2, '0')

  return `${day}.${month}`
}

// Ищем индекс колонки по дате
function findColumnIndex(headerRow, columnName) {
  return headerRow.findIndex(col =>
    normalizeDate(col) === normalizeDate(columnName)
  )
}

// Переводим номер колонки в букву
// 0 -> A
// 1 -> B
// 5 -> F
function getColumnLetter(index) {
  return String.fromCharCode(65 + index)
}

// ================= USERS =================

// Получаем пользователей
async function getUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:Z1000`,
  })

  const rows = res.data.values || []

  return rows.map((row, index) => ({
    row,
    sheetRow: index + 2,
  }))
}

// Получаем заголовки таблицы
async function getHeaderRow() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  })

  return res.data.values[0] || []
}

// Ставим отметку посещения
async function markAttendance(rowNumber, colIndex) {
  const columnLetter = getColumnLetter(colIndex)

  const range = `${sheetName}!${columnLetter}${rowNumber}`

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['✓']],
    },
  })
}

// ================= UNKNOWN =================

// Получаем неизвестных пользователей
async function getUnknownData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${unknownSheet}!A2:Z1000`,
  })

  const rows = res.data.values || []

  return rows.map((row, index) => ({
    row,
    sheetRow: index + 2,
  }))
}

// Получаем заголовки unknown таблицы
async function getUnknownHeader() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${unknownSheet}!1:1`,
  })

  return res.data.values[0] || []
}

// Добавляем неизвестного пользователя
async function addUnknownUser(id) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${unknownSheet}!A:A`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[id]],
    },
  })
}

// Ставим отметку unknown пользователю
async function markUnknown(rowNumber, colIndex) {
  const columnLetter = getColumnLetter(colIndex)

  const range = `${unknownSheet}!${columnLetter}${rowNumber}`

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['✓']],
    },
  })
}

// ================= SCAN =================

app.post('/scan', async (req, res) => {
  const { id } = req.body

  console.log(`📥 SCAN: ${id}`)

  try {
    const today = getTodayColumnName()

    console.log('📅 TODAY:', today)

    // ===== ОСНОВНЫЕ ПОЛЬЗОВАТЕЛИ =====
    const users = await getUsers()

    const user = users.find(u => u.row[0] === id)

    if (user) {
      console.log(`👤 FOUND USER: ${user.row[1]}`)

      const header = await getHeaderRow()

      const colIndex = findColumnIndex(header, today)

      console.log('📍 COLUMN INDEX:', colIndex)

      if (colIndex === -1) {
        console.log('❌ NO COLUMN FOR TODAY')

        return res.json({
          status: 'no_column',
        })
      }

      // Уже отмечен
      if (user.row[colIndex]) {
        console.log('⚠️ DUPLICATE')

        return res.json({
          status: 'duplicate',
          name: user.row[1],
        })
      }

      // Ставим галочку
      await markAttendance(user.sheetRow, colIndex)

      console.log('✅ MARKED ATTENDANCE')

      return res.json({
        status: 'ok',
        name: user.row[1],
      })
    }

    // ===== НЕИЗВЕСТНЫЙ =====
    console.log('❓ UNKNOWN USER')

    const unknownUsers = await getUnknownData()

    const existing = unknownUsers.find(u => u.row[0] === id)

    const header = await getUnknownHeader()

    const colIndex = findColumnIndex(header, today)

    if (colIndex === -1) {
      console.log('❌ NO COLUMN IN UNKNOWN')

      return res.json({
        status: 'no_column',
      })
    }

    // Уже существует
    if (existing) {
      // Уже отмечен сегодня
      if (existing.row[colIndex]) {
        console.log('⚠️ UNKNOWN ALREADY MARKED')

        return res.json({
          status: 'not_found',
        })
      }

      // Ставим отметку
      await markUnknown(existing.sheetRow, colIndex)

      console.log('✏️ UNKNOWN MARKED')

      return res.json({
        status: 'not_found',
      })
    }

    // Новый unknown
    await addUnknownUser(id)

    // Получаем обновлённый список
    const updatedUnknown = await getUnknownData()

    const newUser = updatedUnknown.find(u => u.row[0] === id)

    // Ставим отметку
    if (newUser) {
      await markUnknown(newUser.sheetRow, colIndex)
    }

    console.log('➕ NEW UNKNOWN')

    return res.json({
      status: 'not_found',
    })

  } catch (err) {
    console.error('❌ ERROR:', err)

    return res.status(500).json({
      status: 'error',
    })
  }
})

// ================= HEALTH CHECK =================

app.get('/', (req, res) => {
  console.log('💚 HEALTH CHECK')
  res.send('OK')
})

// ================= START =================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})