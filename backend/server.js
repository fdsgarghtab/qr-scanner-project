const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { google } = require('googleapis')

const app = express()
app.use(cors())
app.use(bodyParser.json())

const PORT = process.env.PORT || 3001

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

// === USERS ===
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

// === UNKNOWN ===
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
  const { id } = req.body

  console.log(`📥 SCAN: ${id}`) // 👈 лог входящего запроса

  try {
    const users = await getUsers()
    const user = users.find(u => u.row[0] === id)

    const today = getTodayColumnName()

    // === НАЙДЕН В ОСНОВНОЙ ТАБЛИЦЕ ===
    if (user) {
      console.log(`👤 FOUND USER: ${user.row[1]}`)

      const header = await getHeaderRow()
      const colIndex = findColumnIndex(header, today)

      if (colIndex === -1) {
        console.log("⚠️ NO COLUMN FOR TODAY")
        return res.json({ status: 'no_column' })
      }

      if (user.row[colIndex]) {
        console.log("⚠️ DUPLICATE SCAN")
        return res.json({
          status: 'duplicate',
          name: user.row[1],
        })
      }

      await markAttendance(user.sheetRow, colIndex)

      console.log("✅ MARKED ATTENDANCE")

      return res.json({
        status: 'ok',
        name: user.row[1],
      })
    }

    // === НЕИЗВЕСТНЫЙ ===
    console.log("❓ UNKNOWN USER")

    const unknownUsers = await getUnknownData()
    const existing = unknownUsers.find(u => u.row[0] === id)

    const header = await getUnknownHeader()
    const colIndex = findColumnIndex(header, today)

    if (colIndex === -1) {
      console.log("⚠️ NO COLUMN IN UNKNOWN SHEET")
      return res.json({ status: 'no_column' })
    }

    if (existing) {
      if (existing.row[colIndex]) {
        console.log("⚠️ UNKNOWN ALREADY MARKED")
        return res.json({ status: 'not_found' })
      }

      await markUnknown(existing.sheetRow, colIndex)

      console.log("✏️ MARKED UNKNOWN EXISTING")

      return res.json({ status: 'not_found' })
    }

    await addUnknownUser(id)

    const updatedUnknown = await getUnknownData()
    const newUser = updatedUnknown.find(u => u.row[0] === id)

    if (newUser) {
      await markUnknown(newUser.sheetRow, colIndex)
    }

    console.log("➕ ADDED NEW UNKNOWN")

    return res.json({ status: 'not_found' })

  } catch (err) {
    console.error("❌ ERROR:", err) // 👈 ВАЖНО: теперь ты увидишь причину
    return res.status(500).json({ status: 'error' })
  }
})

// === HEALTH ===
app.get("/", (req, res) => {
  console.log("💚 HEALTH CHECK")
  res.send("OK")
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})