node-raven
==========

A Node library for communicating with a RFA-Z106 RAVEn USB stick (http://www.rainforestautomation.com/raven).  This device is used for monitoring power and energy data from smart meters configured with the Zigbee Smart Energy profile.

First, the USB stick must be paired with the meter.  Your electricity distributor (whoever is responsible for the meter) should provide a procedure to pair the meter and the device.

Tested on BeagleBone with Angstrom distro v2012-05 and Odroid U3 with Ubuntu 14.04.  The Raspberry Pi does not supply enough USB power for this device without a powered-USB hub.  The RAVEn requires up to 500mA.

This library reads the data streaming from the device, parses it and publishes the information to an MQTT server.  Other services can subscribe to the MQTT topics to receive updates from the meter.  An example is "Whims" (https://github.com/stormboy/whims) which can receive the data via MQTT, serve via Socket.io whereupon a web browser may render the information. 

Dependencies
------------

    npm install serialport
    npm install xml2js

For raven_mqtt.js

    npm install mqttjs

TODO
----

More events from Raven object, such as device info

Separate Raven module from Raven MQTT code. 
