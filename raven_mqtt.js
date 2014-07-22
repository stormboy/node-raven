/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 * Publishes energy data to a MQTT service.
 */

var raven = require("./raven.js")
   	mqtt = require('mqttjs'),
   	crypto = require('crypto');

var TRACE = true;

/**
 * Publishes power/energy events from a Raven USB stick to an MQTT service
 */
var RavenMqtt = function(options) {
	var self = this;
	
	// last known state
	this.state = { power: {}, energyIn: {}, energyOut: {} };
	
	// MQTT topics
	this.TOPIC_power     = options.powerPath || "/house/meter/power/demand";
	this.TOPIC_energyIn  = options.energyInPath || "/house/meter/energy/in";
	this.TOPIC_energyOut = options.energyOutPath || "/house/meter/energy/out";
	
	this.raven = new raven.Raven(options);
	
	this.raven.on("open", function() {
		openHandler(self, options);
	});
}


// handle serial port open
function openHandler (self, options) {
	var mqttClient;

	if (TRACE) {
		console.log('serial device open');
	}
	
	mqtt.createClient(options.mqttPort, options.mqttHost, function(err, client) {
		mqttClient = client;

		// add handlers to MQTT client
		mqttClient.on('connack', function(packet) {
			if (packet.returnCode === 0) {
				console.log('MQTT sessionOpened');

				// subscribe to topics for requests for initial-content (state).
				mqttClient.subscribe({topic: self.TOPIC_power+"?"});
				mqttClient.subscribe({topic: self.TOPIC_energyIn+"?"});
				mqttClient.subscribe({topic: self.TOPIC_energyOut+"?"});
			}
		});
		mqttClient.on('close', function() {
			console.log('MQTT close');
		});
		mqttClient.on('error', function(e) {
			// ??? seems to timeout a lot
			console.log('MQTT error: ' + e);
		});
		mqttClient.addListener('publish', function(packet) {
			// got data from subscribed topic
			if (TRACE) {
				console.log('received ' + packet.topic + ' : ' + packet.payload);
			}

			// check if message is a request for current value, send response
			var i = packet.topic.indexOf("?");
			if (i > 0) {
				var requestTopic = packet.topic.slice(0, i);
				var responseTopic = packet.payload;
				if (TRACE) {
					console.log("requestTopic: " + requestTopic + "  responseTopic: " + responseTopic);
				}
				if (requestTopic == self.TOPIC_power) {
					if (TRACE) {
						console.log("sending power content: " + self.state.power);
					}
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(self.state.power)});
				}
				else if (requestTopic == self.TOPIC_energyIn) {
					if (TRACE) {
						console.log("sending energyIn content: " + self.state.energyIn);
					}
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(self.state.energyIn)});
				}
				else if (requestTopic == self.TOPIC_energyOut) {
					if (TRACE) {
						console.log("sending energyOut content: " + self.state.energyOut);
					}
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(self.state.energyOut)});
				}
			}
		});

        // connect to MQTT service
		crypto.randomBytes(24, function(ex, buf) {		// create a random client ID for MQTT
			var clientId = buf.toString('hex');
			mqttClient.connect({
				keepalive: 60,
				client: clientId
			});
		});

	});

	// add serial port data handler	
	self.raven.on('power', function(power) {
		self.state.power = power;
		mqttClient.publish({
			topic: self.TOPIC_power, 
			payload: JSON.stringify(self.state.power)
		});
	});

	// energy used
	self.raven.on('energy-in', function(energy) {
		self.state.energyIn = energy;
		mqttClient.publish({
			topic: self.TOPIC_energyIn, 
			payload: JSON.stringify(self.state.energyIn)
		});

	});

	// energy fed-in to the grid
	self.raven.on('energy-out', function(energy) {
		self.state.energyOut = energy;
		mqttClient.publish({
			topic: self.TOPIC_energyOut, 
			payload: JSON.stringify(self.state.energyOut)
		});
	});
}

exports.RavenMqtt = RavenMqtt;
