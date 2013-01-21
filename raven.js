/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 */

var util = require('util'),
    serialport = require("serialport"),
    xml2js = require('xml2js'),
    events = require('events');

var TRACE = true;

// date offset for RAVEn which presents timestamp as seconds since 2000-01-01
var dateOffset = Date.UTC(2000, 0, 1);

var Raven = function(options) {
    events.EventEmitter.call(this);            // inherit from EventEmitter
    var self = this;
    
    // configure the serial port that the RAVEn USB dongle is on.
    this.serialPort = new serialport.SerialPort(options.serialPath, {
        baudrate: 115200,
        databits: 8,
        stopbits: 1,
        parity: 'none',
        parser: serialport.parsers.readline("\r\n") 
    });
    
    this.serialPort.on("open", function() {
        openHandler(self);
    });
}

util.inherits(Raven, events.EventEmitter);

/**
 * Get the connection status between the USB device and the power meter 
 */
Raven.prototype.getConnectionStatus = function() {
	var queryCommand = "<Command><Name>get_connection_status</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

/**
 * Get informaiton about the device
 */
Raven.prototype.getDeviceInfo = function() {
	var queryCommand = "<Command><Name>get_device_info</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

/**
 * Query the amount of energy used or fed-in.
 */
Raven.prototype.getSumEnergy = function() {
	var queryCommand = "<Command><Name>get_current_summation_delivered</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

/**
 * Get the power currently being used (or fed-in)
 */
Raven.prototype.getSumPower = function() {
	var queryCommand = "<Command><Name>get_instantaneous_demand</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

Raven.prototype.getMessage = function() {
	var queryCommand = "<Command><Name>get_message</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

Raven.prototype.getTime = function() {
	var queryCommand = "<Command><Name>get_time</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

Raven.prototype.getCurrentPrice = function() {
	var queryCommand = "<Command><Name>get_current_price</Name></Command>\r\n"
	this.serialPort.write(queryCommand);
}

// handle serial port open
function openHandler (self) {
	var parser = new xml2js.Parser();
	var buffer = "";	// read buffer.

    if (TRACE) {	
    	console.log('serial device open');
    }
    
    self.emit("open");

	// add serial port data handler	
	self.serialPort.on('data', function(data) {
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
					if (TRACE) {
						console.log("demand: " + timestamp.toLocaleString() + " : " + demand);
					}
				 	
					// emit power event
					var power = { value: demand, unit: "W", timestamp: timestamp.toISOString() };
					self.emit("power", power);
				}
				else if (result.CurrentSummationDelivered) {
					var timestamp = parseInt( result.CurrentSummationDelivered.TimeStamp );
					timestamp = new Date(dateOffset+timestamp*1000);
					var used = parseInt( result.CurrentSummationDelivered.SummationDelivered, 16 );
					var fedin = parseInt( result.CurrentSummationDelivered.SummationReceived, 16 );
					console.log("sum: " + timestamp.toLocaleString() + " : " + used + " - " + fedin);

					// publish summation on MQTT service
					var energyIn = { value: used, unit: "Wh" , timestamp: timestamp.toISOString() };
					var energyOut = { value: fedin, unit: "Wh", timestamp: timestamp.toISOString() };

					self.emit("energy-in", energyIn);
					self.emit("energy-out", energyOut);
				}
				else if (result.ConnectionStatus) {
					if (TRACE) {
						console.log("connection status: " + result.ConnectionStatus.Status);
					}
					self.emit("connection", result.ConnectionStatus.Status);
				}
				else {
					if (TRACE) {
						console.dir(result);	// display data read in
					}
				}
			});
			buffer = "";	// reset the read buffer
		}
	});

	// Possible commands: get_time, get_current_summation_delivered; get_connection_status; get_instantaneous_demand; get_current_price; get_message; get_device_info.
	var queryCommand = "<Command><Name>get_connection_status</Name></Command>\r\n"
	self.serialPort.write(queryCommand, function(err, results) {
		self.serialPort.write("<Command><Name>get_message</Name></Command>\r\n", function(err, results) {
			self.serialPort.write("<Command><Name>get_current_price</Name></Command>\r\n", function(err, results) {
			});  
		});  
	});  
}

exports.Raven = Raven;
