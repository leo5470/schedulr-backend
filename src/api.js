const express = require('express')
const mongoose = require('mongoose')
const schedule = require('node-schedule')
const line = require('@line/bot-sdk');

const Userdata = require('./schemas/userdata')
const Event = require('./schemas/event')
const UserEvent = require('./schemas/userEvent')
const sendEmail = require('./mail')
const lineCreateRemindMessage = require('./lineFunctionalities')

const router = express.Router()

const jobMap = new Map()

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

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
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: 'text', text: `hello, ${name}`}]
  })
})

router.post("/user/new", async (req, res) => {
  const { userId, email } = req.body
  if(!userId){
    return res.status(400).send({
      "message": "userId not provided."
    })
  }
  try{
    const userdata = new Userdata({
      createdAt: Date.now(),
      userId: userId,
      email: email,
      events: [],
    })
    await userdata.save()
    // Make the following fields invisible
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
    const events = []
    for(eventId in userdata["events"]){
      const event = Event.findById(eventId, 'name')
      events.push({
        "id": eventId,
        "name": event["name"]
      })
    }
    res.status(200).send(userdata)
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
      // Optional
      // deadline: 'Date',
      // doNotify: 'boolean',
    };
    for (const field in expectedFields) {
      if (!(field in data)) {
        return res.status(400).send({
          "message": "${field} not provided."
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
    data["people"] = []
    data["createdAt"] = Date.now()
    if(!data["doNotify"]){
      data["doNotify"] = false
    }
    const event = new Event(data)
    await event.save()
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
    if(!event["people"].includes(userId)){
      event["people"].push(userId)
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
      const job = schedule.scheduleJob(date, () => {
        sendEmail(userdata["email"], event["name"])
        .catch(err => {
          console.log('Failed to send email:', err);
        })
      })
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

router.get("/event/:eventId/getNames", async(req, res) => {
  const { eventId } = req.params
  try {
    const event = await Event.findById(eventId, 'names')
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