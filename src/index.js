const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

require('dotenv').config()

const api = require('./api')

const mongoUri = process.env.MONGO_DB_URI

mongoose.connect(mongoUri)
        .then(() => {
            console.log('MongoDB is connected')
        })
        .catch((err) => {
            console.log(err)
        });

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())

app.use(express.json())

app.use('/', api)

app.get('*', (req, res) => {
	res.status(418).json({ error: 'I\'m a teapot.' })
})

app.use((err, req, res, next) => {
	const status = err.status || 500
	if (status === 500) {
		console.log('The server errored when processing a request')
		console.log(err)
	}

	res.status(status)
	res.send({
		status: status,
		message: err.message,
	})
})

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})

module.exports = app