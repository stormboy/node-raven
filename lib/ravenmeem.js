var meem = require("meem");

/**
 * Output facets for power, energy used (in) and energy exported (out).
 */
/*
	this.TOPIC_power     = options.powerPath || "/house/meter/power/demand";
	this.TOPIC_energyIn  = options.energyInPath || "/house/meter/energy/in";
	this.TOPIC_energyOut = options.energyOutPath || "/house/meter/energy/out";
*/

var RavenMeem = module.exports = function RavenMeem(def) {
	def.facets     = this._getFacets();
	def.properties = this._getProperties(def.properties);
	meem.Meem.call(this, def);

	// local cache of state, used for sending initial content to clients
	this.power = null;			// power used/exported at this point in time
	this.energyIn = null;		// total energy used
	this.energyOut = null;		// total energy exported

	this._init();	
};
util.inherits(RavenMeem, meem.Meem);

RavenMeem.prototype._init = function() {
	var self = this;
	var options = {
		serialPath: getPropertyValue("serialPath")
	};
	this.raven = new Raven(options);

	// power being used (positive) or exported (negative)
	this.raven.on('power', function(power) {
		self.state.power = power;
		self._sendPower(power);
	});

	// energy used
	this.raven.on('energy-in', function(energy) {
		self.state.energyIn = energy;
		self._sendEnergyIn(energy);
	});

	// energy exported/fed-in to the grid
	this.raven.on('energy-out', function(energy) {
		self.state.energyOut = energy;
		self._sendEnergyOut(energy);
	});
	
	this.on("property", function(name, value, oldValue) {
		if (name == "serialPath") {
			// create a new raven instance with new serial path
			self.raven.close();
			self._init();
		}
	});
};

RavenMeem.prototype._getProperties = function(config) {
	var properties = {
		serialPath: {
			description: "path to the serial device",
			type: String,
			value: "/dev/serial/by-id/usb-Rainforest_RFA-Z106-RA-PC_RAVEn_v2.3.21-if00-port0",
		}
	};
	return properties;
};

/**
 * Define the facets for this Meem.
 */
RavenMeem.prototype._getFacets = function() {
	var self = this;

	var handlePowerRequest = function(request) {
		request.respond(self.power);
	};
	var handleEnergyInRequest = function(request) {
		request.respond(self.energyIn);
	};
	var handleEnergyOutRequest = function(request) {
		request.respond(self.energyOut);
	};

	var facets = {
		power: {
			type: "org.meemplex.Linear", 
			direction: meem.Direction.OUT, 
			description: "The current power being used, or exported (negative values)",
			handleContentRequest: handlePowerRequest
		},
		energyIn: {
			type: "org.meemplex.Linear", 
			direction: meem.Direction.OUT, 
			description: "Total energy used",
			handleContentRequest: handleEnergyInRequest
		},
		energyOut: {
			type: "org.meemplex.Linear", 
			direction: meem.Direction.OUT, 
			description: "Total energy exported",
			handleContentRequest: handleEnergyOutRequest
		},
	};
	return facets;
};

RavenMeem.prototype._sendPower = function(power) {
	this.getFacet("power").handleMessage(power);
};

RavenMeem.prototype._sendEnergyIn = function(energyIn) {
	this.getFacet("energyIn").handleMessage(energyIn);
};

RavenMeem.prototype._sendEnergyOut = function(energyOut) {
	this.getFacet("energyOut").handleMessage(energyOut);
};
