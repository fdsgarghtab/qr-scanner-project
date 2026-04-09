const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { google } = require('googleapis')

const app = express()
app.use(cors())
app.use(bodyParser.json())

const PORT = 3001

// === Google Sheets ===
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

const spreadsheetId = '1UjVFuNYTraeIit0JHD6YFwJ5DNI2xj_DedSdZXUGPs8'
const sheetName = 'Лист1'
const unknownSheet = 'Не найденные'

// === HELPERS ===
function getTodayColumnName() {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

function findColumnIndex(headerRow, columnName) {
  return headerRow.indexOf(columnName)
}

function getColumnLetter(index) {
  return String.fromCharCode(65 + index)
}

// === MAIN USERS ===
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

async function getHeaderRow() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  })

  return res.data.values[0]
}

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

// === UNKNOWN USERS ===
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

async function getUnknownHeader() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${unknownSheet}!1:1`,
  })

  return res.data.values[0]
}

// 🔥 Исправлено: теперь не пишем дату/время
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

// === SCAN ===
app.post('/scan', async (req, res) => {
  try {
    const { id } = req.body

    // === ПРОВЕРКА ОСНОВНЫХ ПОЛЬЗОВАТЕЛЕЙ ===
    const users = await getUsers()
    const user = users.find(u => u.row[0] === id)

    const today = getTodayColumnName()

    if (user) {
      const header = await getHeaderRow()
      const colIndex = findColumnIndex(header, today)

      if (colIndex === -1) {
        return res.json({ status: 'no_column' })
      }

      if (user.row[colIndex]) {
        return res.json({
          status: 'duplicate',
          name: user.row[1],
        })
      }

      await markAttendance(user.sheetRow, colIndex)

      return res.json({
        status: 'ok',
        name: user.row[1],
      })
    }

    // === НЕ НАЙДЕННЫЕ ===
    const unknownUsers = await getUnknownData()
    const existing = unknownUsers.find(u => u.row[0] === id)

    const header = await getUnknownHeader()
    const colIndex = findColumnIndex(header, today)

    if (colIndex === -1) {
      return res.json({ status: 'no_column' })
    }

    if (existing) {
      // уже есть такой ID
      if (existing.row[colIndex]) {
        return res.json({ status: 'not_found' }) // уже отмечен сегодня
      }

      await markUnknown(existing.sheetRow, colIndex)

      return res.json({ status: 'not_found' })
    }

    // новый unknown
    await addUnknownUser(id)

    // нужно получить новую строку (последнюю)
    const updatedUnknown = await getUnknownData()
    const newUser = updatedUnknown.find(u => u.row[0] === id)

    if (newUser) {
      await markUnknown(newUser.sheetRow, colIndex)
    }

    return res.json({ status: 'not_found' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ status: 'error' })
  }
})

// === HEALTH ===
app.get("/", (req, res) => {
  res.send("OK")
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})