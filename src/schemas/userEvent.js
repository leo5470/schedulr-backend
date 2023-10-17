const mongoose = require('mongoose')

const UserEventSchema = new mongoose.Schema({
    userId: String,
    eventId: String,
    intervals: [{
        startTime: Date,
        endTime: Date
    }]
})

UserEventSchema.methods.toJSON = function () {
    const obj = this.toObject()
    delete obj["__v"]
    delete obj["_id"]
    return obj
}

module.exports = mongoose.model('userEvent', UserEventSchema)