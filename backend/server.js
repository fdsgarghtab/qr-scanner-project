const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { google } = require('googleapis')

const app = express()
app.use(cors())
app.use(bodyParser.json())

const PORT = 3001

// 🔐 ENV
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ADMIN_TOKEN = "secret_token_123"

// === Google Sheets ===
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

const spreadsheetId = '1UjVFuNYTraeIit0JHD6YFwJ5DNI2xj_DedSdZXUGPs8'
const sheetName = 'Лист1'

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

function getTodayColumnName() {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

function findColumnIndex(headerRow, columnName) {
  return headerRow.indexOf(columnName)
}

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

// === LOGIN ===
app.post('/admin-login', (req, res) => {
  const { password } = req.body

  if (!password) {
    return res.sendStatus(400)
  }

  if (password.trim() === ADMIN_PASSWORD?.trim()) {
    return res.json({ token: ADMIN_TOKEN })
  }

  return res.sendStatus(401)
})

// === ADMIN DATA (ЗАЩИЩЕНО) ===
app.get('/admin-data', async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return res.sendStatus(403)
  }

  const token = authHeader.replace("Bearer ", "")

  if (token !== ADMIN_TOKEN) {
    return res.sendStatus(403)
  }

  try {
    const users = await getUsers()

    const header = await getHeaderRow()
    const today = getTodayColumnName()
    const colIndex = findColumnIndex(header, today)

    let checked = 0
    let logs = []

    users.forEach(u => {
      if (u.row[colIndex]) {
        checked++
        logs.push(u.row[1])
      }
    })

    logs = logs.slice(-10).reverse()

    res.json({
      total: users.length,
      checked,
      logs,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'error' })
  }
})

// === SCAN ===
app.post('/scan', async (req, res) => {
  try {
    const { id } = req.body

    const users = await getUsers()
    const user = users.find(u => u.row[0] === id)

    if (!user) {
      return res.json({ status: 'not_found' })
    }

    const header = await getHeaderRow()
    const today = getTodayColumnName()
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

  } catch (err) {
    console.error(err)
    res.status(500).json({ status: 'error' })
  }
})

// === HEALTH CHECK ===
app.get("/", (req, res) => {
  res.send("OK");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})