node-raven
==========

A Node library for communicating with a RFA-Z106 RAVEn USB stick (http://www.rainforestautomation.com/raven).  This device is used for monitoring power and energy data from smart meters configured with the Zigbee Smart Energy profile.

First, the USB stick must be paired with the meter.  Your electricity distributor (whoever is responsible for the meter) should provide a procedure to pair the meter and the device.

Tested on BeagleBone with Angstrom distro v2012-05.  The Raspberry Pi does not supply enough USB power for this device without a powered-USB hub.  The RAVEn requires up to 500mA.

Dependencies
------------

  npm install serialport
  npm install mqttjs
  npm install xml2js
