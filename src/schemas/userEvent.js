const mongoose = require('mongoose')

const UserEventSchema = new mongoose.Schema({
    userId: String,
    eventId: String,
    intervals: Array[{
        startTime: Date,
        endTime: Date
    }]
})

module.exports = mongoose.model('userEvent', UserEventSchema)