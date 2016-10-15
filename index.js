var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
var apiai = require('apiai');
var util = require("util");

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 3000));

// Server frontpage
app.get('/', function (req, res) {
    res.send('This is TestBot Server');
});

app.get('/test', function (req, res) {
    var api = apiai('e5df3993d9e448bda9845a9de80ec5d9');
    var request = api.textRequest('Hello');

    request.on('response', function(response) {
        console.log("api.ai"+util.inspect(response));

    });

    request.on('error', function(error) {
        console.log("api.ai error:"+util.inspect(error));
    });

    request.end();
    res.send('ok');
});

// Facebook Webhook
app.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === "codeninjas") {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    }
});

app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function(messagingEvent) {
                if (messagingEvent.optin) {
                    receivedAuthentication(messagingEvent);
                } else if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else if (messagingEvent.delivery) {
                    receivedDeliveryConfirmation(messagingEvent);
                } else if (messagingEvent.postback) {
                    receivedPostback(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});
function receivedAuthentication(event) { console.log("receivedAuthentication");};

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageId = message.mid;

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {

        // If we receive a text message, check to see if it matches any special
        // keywords and send back the corresponding example. Otherwise, just echo
        // the text we received.
        switch (messageText) {
            case 'image':
                sendImageMessage(senderID);
                break;

            case 'button':
                sendButtonMessage(senderID);
                break;

            case 'koala':
                sendGenericMessage(senderID);
                break;

            case 'receipt':
                sendReceiptMessage(senderID);
                break;

            default:
                sendTextMessage(senderID, messageText);
        }
    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachment received");
    }
};
function receivedDeliveryConfirmation(event) { console.log("receivedAuthentication");};

function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;

    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    var payload = event.postback.payload;

    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);

    // When a postback is called, we'll send a message back to the sender to
    // let them know it was successful
    sendTextMessage(senderID, "Postback called");
}

function sendTextMessage(recipientId, messageText) {
    var api = apiai('380ae2c971f74c5f878e5140f48890b4');
    var request = api.textRequest(messageText);

    request.on('response', function(response) {
        console.log("api.ai--"+response.result.fulfillment.speech+"--");
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: response.result.fulfillment.speech
            }
        };

        callSendAPI(messageData);
    });

    request.on('error', function(error) {
        console.log("api.ai"+error);
    });

    request.end();


}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}

function sendGenericMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "Koalas",
                        subtitle: "O bot do Moonan",
                        item_url: "https://www.google.pt/search?q=gatos+fofos&espv=2&biw=843&bih=699&source=lnms&tbm=isch&sa=X&ved=0ahUKEwierpvVp_7OAhVCVBQKHWJsD_0Q_AUIBigB",
                        image_url: "http://www.zoo.pt/media/Destaques/koala-destaque.png",
                        buttons: [{
                            type: "web_url",
                            url: "http://google.com",
                            title: "Sobre Mim"
                        }, {
                            type: "web_url",
                            url: "http://google.com",
                            title: "Fotos"
                        }],
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}
