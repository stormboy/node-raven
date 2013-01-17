/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 * Publishes energy data to a MQTT service.
 */

var config = require('./settings'),
    serialport = require("serialport"),
    xml2js = require('xml2js'),
   	mqtt = require('mqttjs'),
   	crypto = require('crypto');

// MQTT topics
var TOPIC_power     = config.powerPath || "/power/house/demand";
var TOPIC_energyIn  = config.energyInPath || "/energy/house/in";
var TOPIC_energyOut = config.energyOutPath || "/energy/house/out";

console.log("power topic: " + TOPIC_power);

// date offset for RAVEn which presents timestamp as seconds since 2000-01-01
var dateOffset = Date.UTC(2000, 0, 1);

// configure the serial port that the RAVEn USB dongle is on.
var serialPort = new serialport.SerialPort(config.serialPath, {
	baudrate: 115200,
	databits: 8,
	stopbits: 1,
	parity: 'none',
	parser: serialport.parsers.readline("\r\n") 
});

// handle serial port open
serialPort.on("open", function () {
	var parser = new xml2js.Parser();
	var buffer = "";	// read buffer.
	var mqttClient;
	var state = { power: {}, energyIn: {}, energyOut: {} };
	
	console.log('serial device open');
	
	mqtt.createClient(config.mqttPort, config.mqttHost, function(err, client) {
		mqttClient = client;

		// add handlers to MQTT client
		mqttClient.on('connack', function(packet) {
			if (packet.returnCode === 0) {
				console.log('MQTT sessionOpened');

				// subscribe to topics for requests for initial-content (state).
				mqttClient.subscribe({topic: TOPIC_power+"?"});
				mqttClient.subscribe({topic: TOPIC_energyIn+"?"});
				mqttClient.subscribe({topic: TOPIC_energyOut+"?"});
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
			console.log('received ' + packet.topic + ' : ' + packet.payload);

			// check if message is a request for current value, send response
			var i = packet.topic.indexOf("?");
			if (i > 0) {
				var requestTopic = packet.topic.slice(0, i);
				var responseTopic = packet.payload;
				console.log("requestTopic: " + requestTopic + "  responseTopic: " + responseTopic);
				if (requestTopic == TOPIC_power) {
					console.log("sending power content: " + state.power);
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(state.power)});
				}
				else if (requestTopic == TOPIC_energyIn) {
					console.log("sending energyIn content: " + state.energyIn);
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(state.energyIn)});
				}
				else if (requestTopic == TOPIC_energyOut) {
					console.log("sending energyOut content: " + state.energyOut);
					mqttClient.publish({topic: responseTopic, payload: JSON.stringify(state.energyOut)});
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
	serialPort.on('data', function(data) {
		buffer += data.toString() + "\r\n";		// append to the read buffer
		if ( data.toString().indexOf('</') == 0 ) {		// check if last part of XML element.
			
			// try to parse buffer
			parser.parseString(buffer, function (err, result) {
				if (err) {
					console.log("err: " + err);
					console.log('data received: ' + buffer);
				}
				else if (result.InstantaneousDemand) {
					var timestamp = parseInt( result.InstantaneousDemand.TimeStamp );
					timestamp = new Date(dateOffset+timestamp*1000);
					var demand = parseInt( result.InstantaneousDemand.Demand, 16 );
					demand = demand < 0x80000000 ? demand : - ~demand - 1;
					console.log("demand: " + timestamp.toLocaleString() + " : " + demand);
				  
					// publish demand on MQTT service
					state.power = { value: demand, unit: "W", timestamp: timestamp.toISOString() };
					mqttClient.publish({
						topic: TOPIC_power, 
						payload: JSON.stringify(state.power)
					});
				
					// TODO store data in database
				}
				else if (result.CurrentSummationDelivered) {
					var timestamp = parseInt( result.CurrentSummationDelivered.TimeStamp );
					timestamp = new Date(dateOffset+timestamp*1000);
					var used = parseInt( result.CurrentSummationDelivered.SummationDelivered, 16 );
					var fedin = parseInt( result.CurrentSummationDelivered.SummationReceived, 16 );
					console.log("sum: " + timestamp.toLocaleString() + " : " + used + " - " + fedin);

					// publish summation on MQTT service
					state.energyIn = { value: used, unit: "Wh" , timestamp: timestamp.toISOString() };
					state.energyOut = { value: fedin, unit: "Wh", timestamp: timestamp.toISOString() };
					mqttClient.publish({
						topic: TOPIC_energyIn, 
						payload: JSON.stringify(state.energyIn)
					});
					mqttClient.publish({
						topic: TOPIC_energyOut, 
						payload: JSON.stringify(state.energyOut)
					});
					
					// TODO store value in database
				}
				else if (result.ConnectionStatus) {
					console.log("connection status: " + result.ConnectionStatus.Status);
				}
				else {
					console.dir(result);	// display data read in
				}
			});
			buffer = "";	// reset the read buffer
		}
	});
	
	// Possible commands: get_time, get_current_summation_delivered; get_connection_status; get_instantaneous_demand; get_current_price; get_message; get_device_info.
	var queryCommand = "<Command><Name>get_connection_status</Name></Command>\r\n"
	serialPort.write(queryCommand, function(err, results) {
		serialPort.write("<Command><Name>get_message</Name></Command>\r\n", function(err, results) {
			serialPort.write("<Command><Name>get_current_price</Name></Command>\r\n", function(err, results) {
			});  
		});  
	});  
});
