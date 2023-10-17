const mongoose = require('mongoose')

const userdataSchema = new mongoose.Schema({
    createdAt: Date,
    userId: String,
    events: [String],
})

userdataSchema.methods.toJSON = function () {
    const obj = this.toObject()
    delete obj["__v"]
    delete obj["_id"]
    return obj
}

module.exports = mongoose.model('userdata', userdataSchema)