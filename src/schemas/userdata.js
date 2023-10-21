const mongoose = require('mongoose')

const UserdataSchema = new mongoose.Schema({
    createdAt: Date,
    userId: String,
    username: String,
    email: String,
    events: [String],
})

UserdataSchema.methods.toJSON = function () {
    const obj = this.toObject()
    delete obj["__v"]
    delete obj["_id"]
    return obj
}

module.exports = mongoose.model('userdata', UserdataSchema)