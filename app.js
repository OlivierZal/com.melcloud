'use strict';

const Homey = require('homey');

class MelCloud extends Homey.App {
    onInit() {
        console.log('Successfully init MelCloud version: %s', Homey.app.manifest.version);


    };
}

module.exports = MelCloud;
