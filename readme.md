## SMS Server Alerts with Node.js
### 15 Min Build Time

For any online service, being available and reliable is extremely important with many companies advertising guaranteed uptime of 99%+. Therefore it is essential that any errors in the system are fixed as soon as possible, and the prerequisite for that is that error reports are delivered quickly to the engineers who are on duty. Providing those error logs via SMS ensures a faster response time compared to email reports and helps companies keep their uptime promises.

In this tutorial, we demonstrate the integration of SMS alerts into a NodeJS application that uses the [Winston](https://www.npmjs.com/package/winston) logging framework.

## Logging Primer

Logging is the default approach for gaining insights into running applications. Before we start building our sample application, let's take a minute to understand two fundamental concepts of logging: levels and transports.

**Levels** indicate the severity of the log item. Common log levels are _debug_, _info_, _warning_ and _error_. For example, a user trying to log in could have the _info_ level, a user entering the wrong password during login could be _warning_ as it's a potential attack, and a user not able to access the system due to a subsystem failure would trigger an  _error_.

**Transports** are different channels into which the logger writes its data. Typical channels are the console, files, log collection servers and services or communication channels such as email, SMS or push notifications.

It's possible and common to set up multiple kinds of transport for the same logger but set different levels for each. In our sample application, we write entries of all severities to the console and a log file. The application will send SMS notifications only for log items that have the _error_ level (or higher, when using more levels).

## Getting Started

The sample application is built in Node.js and uses *Winston* as the logging library. We have also included an example using [Express](https://www.npmjs.com/package/express) and [express-winston](https://www.npmjs.com/package/express-winston) (don't confuse it with _winston-express_ ...) to demonstrate web application request logging.

Before we get started, make sure you have downloaded Node and npm. If not, you can download both [from npmjs.com](https://www.npmjs.com/get-npm).

We've provided the source code in the [MessageBird Guides GitHub repository](https://github.com/messagebirdguides/sms-server-alerts-guide), so you can either clone the sample application with git or download a ZIP file with the code to your computer.

To install the [MessageBird SDK for NodeJS](https://www.npmjs.com/package/messagebird) and the other dependencies mentioned above, open a console pointed at the directory into which you've saved the sample application and run the following command:

````bash
npm install
````

## Building a MessageBird Transport

Winston enables developers to build custom transports and use them with the logger just like built-in transports such as the file or console transports. They are extensions of the `Transport` class and need to implement a constructor for initialization as well as the `log()` method.
We have created one in the file `MessageBirdTransport.js`.

Our SMS alert functionality needs the following information to work:
- A functioning MessageBird API key.
- An originator, i.e., a sender ID for the messages it sends.
- One or more recipients, i.e., the phone numbers of the system engineers that should be informed about problems with the server.

To keep the custom transport self-contained and independent from the way the application wants to provide the information we take all this as parameters in our constructor. Here's the code:

````javascript
const Transport = require('winston-transport');

/**
 * This is a MessageBird Transport for Winston
 */
module.exports = class MessageBirdTransport extends Transport {
  constructor(opts) {
    super(opts);

    // Load and initialize MesageBird SDK
    this.messagebird = require('messagebird')(opts.apiKey);

    // Store required options
    this.recipients = opts.recipients;
    this.originator = opts.originator;
  }
`````

As you can see, the constructor calls the `super()`-constructor to keep basic custom transport behavior intact, then loads and initializes the MessageBird SDK with the key and stores the other the necessary configuration fields as members of the object.

Now, in the `log()` method, again we start with some default code from the basic custom transport class:

````javascript
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });
````

Then, we shorten the log entry, to make sure it fits in the 160 characters of a single SMS so that notifications won't incur unnecessary costs or break limits:

````javascript
    // Shorten log entry
    var text = (info.message.length > 140) ? info.message.substring(0, 140) + ' ...' : info.message;
````

Finally, we call `messagebird.messages.create()` to send an SMS notification. For the required parameters _originator_ and _recipients_ we use the values stored in the constructor, and for `body` we use the (shortened) log text prefixed with the level:

````javascript
    // Send notification with MessageBird SDK
    this.messagebird.messages.create({
        originator : this.originator,
        recipients : this.recipients,
        body : '[' + info.level +'] ' + text
    }, function(err, response) {
      console.log(err, response);
    });
````

The MessageBird API call is asynchronous and uses a callback function. In that callback function, we only log the response to the console and don't do anything else (we can't record it with Winston here because then we might get stuck in an infinite loop ...).

## Configuring Winston and our Transport

In `index.js`, the primary file of our application, we start off by loading the dependencies and the custom transport class:

````javascript
// Load dependencies
var winston = require('winston');
var express = require('express');
var expressWinston = require('express-winston');
var MessageBirdTransport = require('./MessageBirdTransport');
````

We also use dotenv to load configuration data from a `.env` file:

````javascript
// Load configuration from .env file
require('dotenv').config();
````

Copy `env.example` to `.env` and store your information:

````
MESSAGEBIRD_API_KEY=YOUR-API-KEY
MESSAGEBIRD_ORIGINATOR=Winston
MESSAGEBIRD_RECIPIENTS=31970XXXXXXX,31970YYYYYYY
````

You can create or retrieve an API key [in your MessageBird account](https://dashboard.messagebird.com/en/developers/access). The originator can be a phone number you registered through MessageBird or, for countries that support it, an alphanumeric sender ID with at most 11 characters. You can provide one or more comma-separated phone numbers as recipients.

Back in `index.js`, it's time to set up the logger:

````javascript
// Set up Logger
var logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console({
		level: 'debug'
	}),
        new winston.transports.File({
		filename: 'app.log',
		level: 'info'
	}),
        new MessageBirdTransport({
            apiKey : process.env.MESSAGEBIRD_API_KEY,
            originator : process.env.MESSAGEBIRD_ORIGINATOR,
            recipients : process.env.MESSAGEBIRD_RECIPIENTS.split(','),
            level: 'error'
        })
    ]
});
````

The `winston.createLogger()` method takes a variety of optional configuration parameters. Using the `transports` parameter, you can define one or more transports. As you see in the example, we have added three transports:
- The default Console transport, where we log everything starting with the `debug` level.
- A default File transport, where we log `info` and higher into a file called `app.log`.
- Our previously created custom MessageBirdTransport with all the configuration options taken from our environment file. We convert the comma-separated recipients into an array with `split(',')`. This transport only handles log events with the `error` level.

## Configuring Winston for Express

After setting up an Express app, you can call `app.use()` to specify middleware. Middlewares are extensions to Express that touch each request, and they are useful for globally required functionality such as authentication or, in our example, logging:

````javascript
// Configure Winston logging for express
app.use(expressWinston.logger({
    statusLevels : true,
    winstonInstance : logger
}));
````

We provide the previously initialized _winstonInstance_`_logger` so the same logger is used for automated Express request logging and custom log entries. The _statusLevels_ parameter enables a built-in behavior of express-winston that logs requests that report a server error, i.e., have response codes in the 5xx range with `error` level, and uses the `info` level for successful requests with a 2xx response code. This behavior is wholly in line with the intention that we want to report only server errors through our MessageBird transport.

## Testing the Application

We have added some test log entries in `index.js` and we have also created an Express test route to simulate a 500 server response. To run the application, go to your console and type the following command:

````bash
node index.js
````

You should see:
- Four messages printed on the console.
- Three log items written to the `app.log` file (open it with a text editor or with `tail` in a new console tab).
- One error message on your phone.

Navigate your browser to http://localhost:8080/. For the successful request, you will see a log entry on the console and in the file.

Now, open http://localhost:8080/simulateError and, along with the request error on your console and the log file, another notification will arrive at your phone.

## Nice work!
And that's it. You've learned how to log with Winston and express-winston, create a custom MessageBird transport. You can now take these elements and integrate them into a Node.js production application.

## Next steps
Want to build something similar but not quite sure how to get started? Please feel free to let us know at support@messagebird.com, we'd love to help!
