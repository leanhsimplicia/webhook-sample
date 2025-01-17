require('dotenv').config()
const https = require('https');
const fs = require('fs');
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const options = {
  cert: fs.readFileSync('/etc/letsencrypt/live/qa1.simplicia.co/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/qa1.simplicia.co/privkey.pem')
};
const app = express()
const request = require('request');


app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.status(200)
  res.send(`Zoom Webhook sample successfully running. Set this URL with the /webhook path as your apps Event notification endpoint URL. https://github.com/zoom/webhook-sample`)
})

app.post('/webhook', (req, res) => {

  var response

  console.log(req.headers)
  console.log(req.body)

  // construct the message string
  const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`

  const hashForVerify = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(message).digest('hex')

  // hash the message string with your Webhook Secret Token and prepend the version semantic
  const signature = `v0=${hashForVerify}`

  // you validating the request came from Zoom https://marketplace.zoom.us/docs/api-reference/webhook-reference#notification-structure
  if (req.headers['x-zm-signature'] === signature) {
    const event = req.body.event;
    // Zoom validating you control the webhook endpoint https://marketplace.zoom.us/docs/api-reference/webhook-reference#validate-webhook-endpoint
    if(event === 'endpoint.url_validation') {
      const hashForValidate = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(req.body.payload.plainToken).digest('hex')

      response = {
        message: {
          plainToken: req.body.payload.plainToken,
          encryptedToken: hashForValidate
        },
        status: 200
      }

      console.log(response.message)

      res.status(response.status)
      res.json(response.message)
    } else if (event == 'meeting.ended') {
      let payload = req.body.payload.object;
      let mix_panel_event_properties = {
          time: Date.now(),
          distinct_id: "ZoomApp",
          $insert_id: Buffer.from(payload["uuid"]).toString('base64'),
          start_time: payload["start_time"],
          end_time: payload["end_time"],
          time_zone: payload["timezone"],
          duration: payload["duration"],
          topic: payload["topic"],
          id: payload["id"]
      }
      request({
          url: "https://api-eu.mixpanel.com/import?strict=1",
          method: "POST",
          json: true,
          body: [{"event": 'ZOOM_MEETING_EVENT', "properties": mix_panel_event_properties}],
          headers: {
              "Content-Type": "application/json",
              "Accept":  "application/json",
              "Authorization": "Basic " + Buffer.from(`${process.env.REMOTE_ACCESS_MIXPANEL_KEY}:`).toString('base64')
          },
      }, function (error, response, body){
          console.log(body);
      });
      response = { message: 'Zoom event processed', status: 200 }
      res.status(response.status)
      res.json(response)
    } else {
      response = { message: 'Authorized request to Zoom Webhook sample.', status: 200 }

      console.log(response.message)

      res.status(response.status)
      res.json(response)

      // business logic here, example make API request to Zoom or 3rd party

    }
  } else {

    response = { message: 'Unauthorized request to Zoom Webhook sample.', status: 401 }

    console.log(response.message)

    res.status(response.status)
    res.json(response)
  }
})

https.createServer(options, app).listen(4000);
