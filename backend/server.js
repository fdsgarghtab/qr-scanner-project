const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { google } = require('googleapis')

const app = express()
app.use(cors())
app.use(bodyParser.json())


const PORT = 3001

// === Google Sheets настройка ===
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

const spreadsheetId = '1UjVFuNYTraeIit0JHD6YFwJ5DNI2xj_DedSdZXUGPs8'
const sheetName = 'Лист1'

// === Получить всех пользователей ===
async function getUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:Z1000`,
  })

  const rows = res.data.values || []

  // 🔥 сохраняем реальный номер строки
  return rows.map((row, index) => ({
    row,
    sheetRow: index + 2,
  }))
}

// === Получить заголовки ===
async function getHeaderRow() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  })

  return res.data.values[0]
}

// === Сегодняшняя дата ===
function getTodayColumnName() {
  const today = new Date()

  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}`
}

// === Найти колонку ===
function findColumnIndex(headerRow, columnName) {
  return headerRow.indexOf(columnName)
}

// === Поставить отметку ===
async function markAttendance(rowNumber, colIndex) {
  const columnLetter = String.fromCharCode(65 + colIndex)

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

// === Записываем незарегестрированных ===
async function addOrUpdateUnknownUser(id) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Не найденные!A2:Z1000`,
  })

  const rows = res.data.values || []

  // ищем пользователя
  let userIndex = rows.findIndex(row => row[0] === id)

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Не найденные!1:1`,
  })

  const header = headerRes.data.values[0]

  const today = getTodayColumnName()
  const colIndex = header.indexOf(today)

  if (colIndex === -1) {
    throw new Error("Нет колонки с датой")
  }

  // если НЕ найден → создаём
  if (userIndex === -1) {
    const newRow = []
    newRow[0] = id
    newRow[1] = new Date().toLocaleString()

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `Не найденные!A:B`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    })

    // после добавления считаем, что он в последней строке
    userIndex = rows.length
  }

  const rowNumber = userIndex + 2

  // проверка дубля
  const currentValue = rows[userIndex]?.[colIndex]

  if (currentValue) {
    return { status: 'duplicate' }
  }

  const columnLetter = String.fromCharCode(65 + colIndex)

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Не найденные!${columnLetter}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['✓']],
    },
  })

  return { status: 'ok' }
}

// === Скан ===
app.post('/scan', async (req, res) => {
  try {
    const { id } = req.body

    const users = await getUsers()

    // 🔥 ищем пользователя правильно
    const user = users.find(u => u.row[0] === id)

    if (!user) {
  const result = await addOrUpdateUnknownUser(id)

  return res.json({
    status: result.status === 'duplicate' ? 'duplicate' : 'not_found',
  })
}

    const header = await getHeaderRow()
    const today = getTodayColumnName()
    const colIndex = findColumnIndex(header, today)

    if (colIndex === -1) {
      return res.json({ status: 'no_column' })
    }

    const row = user.row
    const sheetRow = user.sheetRow

    // проверка на дубль
    if (row[colIndex]) {
      return res.json({
        status: 'duplicate',
        name: row[1],
      })
    }

    // 🔥 запись в ПРАВИЛЬНУЮ строку
    await markAttendance(sheetRow, colIndex)

    return res.json({
      status: 'ok',
      name: row[1],
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ status: 'error' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})