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
 
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Shorten log entry
    var text = (info.message.length > 140) ? info.message.substring(0, 140) + ' ...' : info.message;

    // Send notification with MessageBird SDK
    this.messagebird.messages.create({
        originator : this.originator,
        recipients : this.recipients,
        body : '[' + info.level +'] ' + text
    }, function(err, response) {
      console.log(err, response);
    });
 
    callback();
  }
};