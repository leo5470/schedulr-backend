const mongoose = require('mongoose')

const EventSchema = new mongoose.Schema({
    name: String,
    createdAt: Date,
    createdBy: String, // userId
    numOfPeople: Number,
    people: [{
        userId: String,
        username: String
    }], // should include creator
    startDate: Date,
    endDate: Date,
    description: String,
    deadline: Date,
    doNotify: Boolean,
    isAvailable: Boolean
})

EventSchema.methods.toJSON = function () {
    const obj = this.toObject()
    delete obj["__v"]
    obj["eventId"] = obj["_id"]
    delete obj["_id"]
    return obj
}

module.exports = mongoose.model('event', EventSchema)