const express = require('express')
const mongoose = require('mongoose')

const Userdata = require('./schemas/userdata')
const Event = require('./schemas/event')
const UserEvent = require('./schemas/userEvent')

const router = express.Router()

router.get("/test", (req, res) => {
    res.send({ msg: "you are amazing!" })
  })

module.exports = router