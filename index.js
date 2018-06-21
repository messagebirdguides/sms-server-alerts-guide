// Load dependencies
var winston = require('winston');
var express = require('express');
var expressWinston = require('express-winston');
var MessageBirdTransport = require('./MessageBirdTransport');

// Load configuration from .env file
require('dotenv').config();

// Set up Logger
var logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console({ level: 'debug' }),
        new winston.transports.File({ filename: 'app.log', level: 'info' }),
        new MessageBirdTransport({
            apiKey : process.env.MESSAGEBIRD_API_KEY,
            originator : process.env.MESSAGEBIRD_ORIGINATOR,
            recipients : process.env.MESSAGEBIRD_RECIPIENTS.split(','),
            level: 'error'
        })
    ]
});

// Make some test log entries
logger.debug("This is a test at debug level.");
logger.info("This is a test at info level.");
logger.warn("This is a test at warning level.");
logger.error("This is a test at error level.");

// Set up Express app
var app = express();

// Configure Winston logging for express
app.use(expressWinston.logger({
    statusLevels : true,
    winstonInstance : logger
}));

// Demo Regular Route
app.get('/', function(req, res) {
    res.send("Hello World :)");
});

// Demo Error Route
app.get('/simulateError', function(req, res) {
    res.status(500)
    res.send("This should trigger error handling!");
});

// Start the application
app.listen(8080);
