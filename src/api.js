const express = require('express')
const mongoose = require('mongoose')
const schedule = require('node-schedule')
const line = require('@line/bot-sdk');

const Userdata = require('./schemas/userdata')
const Event = require('./schemas/event')
const UserEvent = require('./schemas/userEvent')
const sendEmail = require('./mail')
// const lineCreateRemindMessage = require('./lineFunctionalities')

const router = express.Router()

const jobMap = new Map()

// const client = new line.messagingApi.MessagingApiClient({
//   channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
// });

function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) // verify if the string is successfully parsed into a date object.
}

function isValidIntervals(intervals) {
  return intervals.every(interval => {
    const { startTime, endTime } = interval;

    // Check if startTime and endTime are valid Date objects
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
      return false;
    }

    // Check if startTime is less than endTime
    return startTime < endTime;
  });
}

router.get("/test", (req, res) => {
    res.send({ msg: "you are amazing!" })
})

router.post("/test/send", async (req, res) => {
  const { name, lineUserId } = req.body
  try {
    await client.pushMessage({
    to: lineUserId,
    messages: [{ type: 'text', text: `hello, ${name}`}]
    })
    res.status(200).send('OK')
  } catch (e) {
    res.status(500).send({
      "message": e.message
    })
  }
})

router.post("/user/new", async (req, res) => {
  const { userId, username, email } = req.body
  if(!userId){
    return res.status(400).send({
      "message": "userId not provided."
    })
  }
  if(!username){
    return res.status(400).send({
      "message": "username not provided."
    })
  }
  if(!email){
    return res.status(400).send({
      "message": "email not provided."
    })
  }
  try{
    const userdata = new Userdata({
      createdAt: Date.now(),
      userId: userId,
      username: username,
      email: email,
      events: [],
    })
    await userdata.save()
    res.status(200).send(userdata)
  } catch (e) {
    res.status(500).send({
      "message": e.message
    })
  }
})

router.post("/user/new/clerk", async (req, res) => {
  const data = req.body.data
  const userId = data.id
  const username = data.username
  const email = data.email_addresses[0].email_address
  let lineId = null
  // if(data.external_accounts[0].provider === "oauth_line"){
  //   lineId = data.external_accounts[0].provider_user_id
  // }
  try{
    const userdata = new Userdata({
      createdAt: Date.now(),
      userId: userId,
      username: username,
      email: email,
      lineId: lineId,
      events: [],
    })
    await userdata.save()
    res.status(200).send(userdata)
  } catch (e) {
    res.status(500).send({
      "message": e.message
    })
  }
})

// TODO: test
router.get("/user/:userId/events", async (req, res) => {
  const { userId } = req.params
  if(!userId){
    return res.status(400).send({
      "message": "userId not provided."
    })
  }
  try{
    const userdata = await Userdata.findOne({
      userId: userId
    }, 'userId events')
    if(!userdata){
      return res.status(404).send({
        "message": "User not found."
      })
    }
    const events = []
    for(eventId in userdata["events"]){
      const event = Event.findById(eventId, 'name')
      events.push({
        "eventId": eventId,
        "name": event["name"]
      })
    }
    res.status(200).send(userdata)
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "User not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.post("/event/create", async (req, res) => {
  try{
    const data = req.body;
    const expectedFields = {
      userId: 'string',
      name: 'string',
      numOfPeople: 'number',
      startDate: 'Date',
      endDate: 'Date',
      description: 'string',
      isAvailable: 'boolean'
      // Optional
      // deadline: 'Date',
      // doNotify: 'boolean',
    };
    const userdata = Userdata.findOne({userId: data["userId"]})
    if(!userdata){
      req.send(400).send({
        "message": "Can't create event since user does not exist."
      })
    }
    for (const field in expectedFields) {
      if (!(field in data)) {
        return res.status(400).send({
          "message": `${field} not provided.`
        })
      }
      const fieldType = expectedFields[field];
      if (fieldType === 'Date' && !(isValidDate(data[field]))) {
        return res.status(400).json({ error: `Invalid data type for ${field}. Expected Date.` });
      } 
      if (typeof data[field] !== fieldType && fieldType !== 'Date') { // No need to check for Date
        return res.status(400).json({ error: `Invalid data type for ${field}. Expected ${fieldType}.` });
      }
    }
    data["createdBy"] = data["userId"]
    data["userId"] = undefined
    data["people"] = [{userId: userdata["userId"], username: userdata["username"]}]
    data["createdAt"] = Date.now()
    if(!data["doNotify"]){
      data["doNotify"] = false
    }
    const event = new Event(data)
    await event.save()
    const eventId = event["_id"]
    const userId = data["createdBy"]
    const userEvent = new UserEvent({
      userId: userId,
      eventId: eventId,
      voted: false,
      intervals: []
    })
    await userEvent.save()
    return res.status(200).send(event.toJSON())
  } catch (e) {
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.patch("/event/:eventId/join", async (req, res) => {
  const { userId } = req.body
  const { eventId } = req.params
  if(!userId){
    return res.status(400).send({
      "message" : "userId not provided."
    })
  }
  try{
    const event = await Event.findById(eventId)
    if(event["eventId"].length === event["numOfPeople"]){
      return res.status(400).send({
        "message": "Event is full."
      })
    }
    const userdata = await Userdata.findOne({
      userId: userId
    })
    if(!userdata){
      return res.status(404).send({
        "message": "User not found."
      })
    }
    if(!userdata["events"].includes(eventId)){
      userdata["events"].push(eventId)
      await userdata.save()
    }
    if(!event){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    if(!event["people"].includes({userId: userId, username: userdata["username"]})){
      event["people"].push({userId: userId, username: userdata["username"]})
      await event.save()
    }
    if(!await UserEvent.findOne({
      userId: userId,
      eventId: eventId
    })){
      const userEvent = new UserEvent({
        userId: userId,
        eventId: eventId,
        voted: false,
        intervals: []
      })
      await userEvent.save()
    }
    if(event["doNotify"]){
      const date = event["deadline"]
      date.setHours(date.getHours() - 2)
      let job
      if(!userdata["lineId"]){
        job = schedule.scheduleJob(date, () => {
          sendEmail(userdata["email"], event["name"])
          .catch(err => {
            console.log('Failed to send email:', err)
          })
        })
      } 
      // else {
      //   job = schedule.scheduleJob(date, () => {
      //     client.pushMessage({
      //       to: userdata["lineId"],
      //       messages: [{type: "text", text: lineCreateRemindMessage(event["name"])}]
      //     })
      //     .catch(err => {
      //       console.log('Failed to send LINE message:', err)
      //     })
      //   })
      // }
      const key = `${eventId}_${userId}`
      jobMap.set(key, job)
    }
    return res.status(200).send(userdata.toJSON())
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

// TODO: test functions below
router.patch("/event/:eventId/editTime", async (req, res) => {
  const { userId, intervals } = req.body
  const { eventId } = req.params
  if(!userId){
    return res.status(400).send({
      "message" : "userId not provided."
    })
  }
  if(!intervals){
    return res.status(400).send({
      "message" : "intervals not provided."
    })
  }
  if(!isValidIntervals(intervals)){
    return res.status(400).send({
      "message" : "Invalid intervals."
    })
  }
  try{
    if(!await Userdata.exists({
      userId: userId
    })){
      return res.status(404).send({
        "message": "User not found."
      })
    }
    if(!await Event.exists({
      eventId: eventId
    })){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    const userEvent = await UserEvent.findOne({
      userId: userId,
      eventId: eventId
    })
    if(!userEvent){
      return res.status(403).send({
        "message": "User is not part of the event."
      })
    }
    userEvent["intervals"] = intervals
    if(!userEvent["voted"]){
      userEvent["voted"] = true
      const key = `${eventId}_${userId}`
      const job = jobMap.get(key)
      job.cancel()
      jobMap.delete(key)
    }
    await userEvent.save()
    return res.status(200).send(userEvent.toJSON())
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.get("/event/:eventId/getEvent", async (req, res) => {
  const { eventId } = req.params
  try {
    const event = await Event.findById(eventId)
    if(!event){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    return res.status(200).send(event.toJSON())
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.get("/event/:eventId/getPeople", async(req, res) => {
  const { eventId } = req.params
  try {
    const event = await Event.findById(eventId, 'people')
    if(!event){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    return res.status(200).send(event.toJSON())
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.get("/event/:eventId/getTime", async (req, res) => {
  const { eventId } = req.params
  try {
    const event = await Event.findById(eventId)
    const timeMap = new Map()

    for(userId in event["people"]["userId"]){
      const userEvent = UserEvent.findOne({
        eventId: eventId,
        userId: userId
      })
      for(interval in userEvent["intervals"]){
        if(timeMap.has(interval)){
          timeMap[interval] += 1
        } else {
          timeMap.set(interval, 1)
        }
      }
      const mapObj = Object.fromEntries(timeMap)
      const resObj = {
        "eventId": eventId,
        "time": mapObj
      }
      res.status(200).json(resObj)
    }
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.get("/event/:eventId/getTime/:userId", async (req, res) => {
  const { eventId, userId } = req.params
  try {
    if(!await Userdata.exists({
      userId: userId
    })){
      return res.status(404).send({
        "message": "User not found."
      })
    }
    if(!await Event.exists({
      eventId: eventId
    })){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    const userEvent = await UserEvent.findOne({
      eventId: eventId,
      userId: userId
    })
    return res.status(200).send(userEvent.toJSON())
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

router.get("/event/:eventId/getVoted", async (req, res) => {
  const { eventId } = req.params
  try {
    const event = await Event.findById(eventId)
    if(!event){
      return res.status(404).send({
        "message": "Event not found."
      })
    }
    const { people } = event
    var voted = 0
    for(const userId in people){
      var individual = await UserEvent.findOne({
        eventId: eventId,
        userId: userId
      })
      if(individual["voted"]){
        voted++
      }
    }
    return res.status(200).send({
      "voted": voted,
      "total": people.length
    })
  } catch (e) {
    if(e instanceof mongoose.CastError) { // If the _id string cannot cast to proper ObjectId, still identify as not found.
      return res.status(404).send({
        "error": "Event not found"
      })
    }
    return res.status(500).send({
      "message": e.message
    })
  }
})

module.exports = router