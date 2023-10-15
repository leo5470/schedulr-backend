const mongoose = require('mongoose')

const EventSchema = new mongoose.Schema({
    createdAt: Date,
    createdBy: String, // userId
    numOfPeople: Number,
    people: Array[String], // Array of userId, should include creator
    startDate: Date,
    endDate: Date,
    deadline: Date,
    doNotify: Boolean,
})

module.exports = mongoose.model('event', EventSchema)