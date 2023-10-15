const mongoose = require('mongoose')

const userdataSchema = new mongoose.Schema({
    createdAt: Date,
    userId: String,
    events: Array[String],
})

module.exports = mongoose.model('userdata', userdataSchema)