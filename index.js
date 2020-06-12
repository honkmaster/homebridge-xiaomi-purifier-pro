'use strict';
// https://github.com/aschzero/homebridge-airmega/blob/master/lib/services/PurifierService.ts
// https://github.com/Colorado4Wheeler/HomeKit-Bridge/wiki/HomeKit-Model-Reference

var Service, Characteristic;
var MiioDevice = require('./MiioAirPurifier');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-xiaomi-air-purifier-pro", "MiAirPurifierPro", AirPurifier);
}

function AirPurifier(log, config) {
    var that = this;
    this.log = log;
    this.services = [];    

    this.enableLED = config['enableLED'] || false;
    this.enableLEDName = config["enableLEDName"].length > 0 || "LED";
    this.enableBuzzer = config['enableBuzzer'] || false;
    this.enableBuzzerName = config["enableBuzzerName"].length > 0 || "Buzzer";

    this.showTemperature = config['showTemperature'] || true;
    this.showTemperatureName = config["showTemperatureName"].length > 0 || "Temperature";
    this.showHumidity = config['showHumidity'] || true;
    this.showHumidityName = config["showHumidityName"].length > 0 || "Humidity";
    this.showAirQuality = config['showAirQuality'] || true;
    this.showAirQualityName = config["showAirQualityName"].length > 0 || "Air Quality";

    this.polling_interval = config['polling_interval'] || 60000;


    if (Array.isArray(config['pm25_breakpoints']) && config['pm25_breakpoints'].length >= 4) {
        this.pm25_breakpoints = config['pm25_breakpoints'];
    }
    else {
        this.pm25_breakpoints = [5, 12, 35, 55];
    }

    this.device = new MiioDevice(config['token'], config['ip']);

    this.device.onChange('power', value => {
        that.updateActive();
        that.updateStatusActive();
        that.updateCurrentAirPurifierState();
    });

    this.device.onChange('mode', value => {
        that.updateTargetAirPurifierState();
    });

    this.device.onChange('favorite_level', value => {
        that.updateRotationSpeed();
        that.updateCurrentAirPurifierState();
    });

    this.device.onChange('child_lock', value => {
        that.updateLockPhysicalControls();
    });

    this.device.onChange('filter_level', value => {
        that.updateFilterChangeIndication();
        that.updateFilterLifeLevel();
    });

    if (this.showAirQuality) {
        this.device.onChange('aqi', value => {
            that.updateAirQuality();
            that.updatePM2_5Density();
        });
    }

    if (this.showTemperature) {
        this.device.onChange('temp', value => {
            that.updateTemperature();
        });
    }

    if (this.showHumidity) {
        this.device.onChange('humidity', value => {
            that.updateHumidity();
        });
    }

    if (this.enableLED) {
        this.device.onChange('led', value => {
            that.updateLED();
        });
    }

    if (this.enableBuzzer) {
        this.device.onChange('buzzer', value => {
            that.updateBuzzer();
        });
    }

    setInterval(function () {
        try {
            that.log('Polling properties every ' + that.polling_interval + ' milliseconds');
            that.device.pollProperties();
        } catch (e) {
            that.log(e);
        }
    }, that.polling_interval);
}

AirPurifier.prototype.getServices = function () {
    // Accessory Information Service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
        .setCharacteristic(Characteristic.Model, 'zhimi.airpurifier.v7')
        .setCharacteristic(Characteristic.SerialNumber, this.token)
        .setCharacteristic(Characteristic.FirmwareRevision, '1.0.0')

    // Service
    this.service = new Service.AirPurifier(this.name);

    this.service
        .getCharacteristic(Characteristic.Active)
        .on('get', this.getActive.bind(this))
        .on('set', this.setActive.bind(this));

    this.service
        .getCharacteristic(Characteristic.CurrentAirPurifierState)
        .on('get', this.getCurrentAirPurifierState.bind(this));

    this.service
        .getCharacteristic(Characteristic.TargetAirPurifierState)
        .on('get', this.getTargetAirPurifierState.bind(this))
        .on('set', this.setTargetAirPurifierState.bind(this));

    this.service
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getRotationSpeed.bind(this))
        .on('set', this.setRotationSpeed.bind(this));

    this.service
        .getCharacteristic(Characteristic.LockPhysicalControls)
        .on('get', this.getLockPhysicalControls.bind(this))
        .on('set', this.setLockPhysicalControls.bind(this));

    this.service.
        getCharacteristic(Characteristic.FilterChangeIndication)
        .on('get', this.getFilterChangeIndication.bind(this));

    this.service.
        getCharacteristic(Characteristic.FilterLifeLevel)
        .on('get', this.getFilterLifeLevel.bind(this));

    // LED
    if (this.enableLED) {
        this.lightService = new Service.Lightbulb('LED');
        this.lightService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getLED.bind(this))
            .on('set', this.setLED.bind(this));
        this.services.push(this.lightService);
    }

    // Buzzer
    if (this.enableBuzzer) {
        this.buzzerService = new Service.Switch('Buzzer');
        this.buzzerService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getBuzzer.bind(this))
            .on('set', this.setBuzzer.bind(this));
        this.services.push(this.buzzerService);
    }

     // Air Quality Sensor
     if (this.showAirQuality) {
        this.airQualitySensorService = new Service.AirQualitySensor(this.showAirQualityName);

        this.airQualitySensorService
            .getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
        this.airQualitySensorService
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.getAirQuality.bind(this));
        this.airQualitySensorService
            .getCharacteristic(Characteristic.PM2_5Density)
            .on('get', this.getPM2_5Density.bind(this));
        this.services.push(this.airQualitySensorService);
    }

    // Temperature Sensor
    if (this.showTemperature) {
        this.temperatureSensorService = new Service.TemperatureSensor(this.showTemperatureName);

        this.temperatureSensorService
            .getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
        this.temperatureSensorService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));
        this.services.push(this.temperatureSensorService);
    }

    // Humidity Sensor
    if (this.showHumidity) {
        this.humiditySensorService = new Service.HumiditySensor(this.showHumidityName);

        this.humiditySensorService
            .getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
        this.humiditySensorService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this));
        this.services.push(this.humiditySensorService);
    }

    // Publish Services
    this.services.push(this.informationService);
    this.services.push(this.service);

    
    return this.services;
}

AirPurifier.prototype.getActive = function (callback) {
    this.log('getActive');

    try {
        var value = this.device.get('power');

        if (value == true) {
            return callback(null, Characteristic.Active.ACTIVE);
        } else {
            return callback(null, Characteristic.Active.INACTIVE);
        }
    } catch (e) {
        this.log('getActive Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setActive = function (targetState, callback, context) {
    this.log('setActive ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.Active.ACTIVE) {
            this.device.set('power', 'on');

        } else {
            this.device.set('power', 'off');
        }

        callback();
    } catch (e) {
        this.log('setActive Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateActive = function () {

    try {
        var value = this.device.get('power');
        var targetValue = value ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;

        this.service
            .getCharacteristic(Characteristic.Active)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateActive to ' + value);
    } catch (e) {
        this.log('updateActive Failed: ' + e);
    }
}

AirPurifier.prototype.getCurrentAirPurifierState = function (callback) {
    this.log('getCurrentAirPurifierState');

    try {
        var value = this.device.get('power');

        if (value == true) {
            if (this.device.getSpeed() == 0) {
                return callback(null, Characteristic.CurrentAirPurifierState.IDLE);
            } else {
                return callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
            }
        }
        else {
            return callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
        }

    } catch (e) {
        this.log('getCurrentAirPurifierState Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateCurrentAirPurifierState = function (callback) {

    try {
        var value = this.device.get('power');
        var targetValue = Characteristic.CurrentAirPurifierState.INACTIVE;

        if (value == true) {
            if (this.device.getSpeed() == 0) {
                targetValue = Characteristic.CurrentAirPurifierState.IDLE;
            } else {
                targetValue = Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
            }
        }

        this.service.setCharacteristic(Characteristic.CurrentAirPurifierState, targetValue);

        this.log('updateCurrentAirPurifierState to ' + value);

    } catch (e) {
        this.log('updateCurrentAirPurifierState Failed: ' + e);
    }
}

AirPurifier.prototype.getTargetAirPurifierState = function (callback) {
    this.log('getTargetAirPurifierState');

    try {

        var value = this.device.get('mode');

        if (value == 'auto') {
            callback(null, Characteristic.TargetAirPurifierState.AUTO);
        } else {
            callback(null, Characteristic.TargetAirPurifierState.MANUAL);
        }
    } catch (e) {
        this.log('getTargetAirPurifierState Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setTargetAirPurifierState = function (targetState, callback, context) {
    this.log('setTargetAirPurifierState ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {

        if (targetState == Characteristic.TargetAirPurifierState.AUTO) {

            this.device.set('mode', 'auto');

        } else {
            if (this.device.get('mode') == 'auto') {
                this.device.set('mode', 'favorite');
            }
        }

        callback();
    } catch (e) {
        this.log('setTargetAirPurifierState Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateTargetAirPurifierState = function () {

    try {
        var value = this.device.get('mode');
        var targetValue;


        if (value == 'auto') {
            var targetValue = Characteristic.TargetAirPurifierState.AUTO;
        } else {
            var targetValue = Characteristic.TargetAirPurifierState.MANUAL;
        }

        this.service
            .getCharacteristic(Characteristic.TargetAirPurifierState)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateTargetAirPurifierState to ' + value);
    } catch (e) {
        this.log('updateTargetAirPurifierState Failed: ' + e);
    }
}

AirPurifier.prototype.getRotationSpeed = function (callback) {
    this.log('getRotationSpeed');

    try {
        var value = this.device.getSpeed();

        callback(null, value);
    } catch (e) {
        this.log('getRotationSpeed Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setRotationSpeed = function (targetSpeed, callback, context) {
    this.log('setRotationSpeed ' + targetSpeed + " " + context);

    if (context === 'fromOutsideHomekit') { return callback(null) }

    try {
        if (targetSpeed > 0) {
            this.device.setSpeed(targetSpeed);
        }


        if (this.device.get('mode') == 'auto') {
            this.device.set('mode', 'favorite');
        }

        callback(null);

    } catch (e) {
        this.log('setRotationSpeed Failed : ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateRotationSpeed = function () {

    try {
        var value = this.device.getSpeed();

        this.service
            .getCharacteristic(Characteristic.RotationSpeed)
            .setValue(value, undefined, 'fromOutsideHomekit');

        this.log('updateRotationSpeed to ' + value);
    } catch (e) {
        this.log('updateRotationSpeed Failed : ' + e);
    }
}

AirPurifier.prototype.getLockPhysicalControls = function (callback) {
    this.log('getLockPhysicalControls');

    try {
        var value = this.device.get('child_lock');

        if (value == 'on') {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
        } else {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
        }
    } catch (e) {
        this.log('getLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setLockPhysicalControls = function (targetState, callback, context) {
    this.log('setLockPhysicalControls ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED) {
            this.device.set('child_lock', 'on');
        } else {
            this.device.set('child_lock', 'off');
        }

        callback();
    } catch (e) {
        this.log('setLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateLockPhysicalControls = function () {

    try {

        var value = this.device.get('child_lock');

        var targetValue;
        if (value == 'on') {
            targetValue = Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
        }
        else {
            targetValue = Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED
        };

        this.service
            .getCharacteristic(Characteristic.LockPhysicalControls)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateLockPhysicalControls to ' + value);
    } catch (e) {
        this.log('updateLockPhysicalControls Failed: ' + e);
    }
}

AirPurifier.prototype.getLED = function (callback) {
    this.log('getLED');

    try {
        var value = this.device.get('led');

        if (value == true) {
            return callback(null, true);
        }
        else {
            return callback(null, false);
        }
    } catch (e) {
        this.log('getLED Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setLED = function (targetState, callback, context) {
    this.log('setLED ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {

        if (targetState == true) {
            this.device.set('led', 'on');
        } else {
            this.device.set('led', 'off');
        }

        callback();
    } catch (e) {
        this.log('setLED Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateLED = function () {

    try {

        var value = this.device.get('led');

        var targetValue;
        if (value == true) {
            targetValue = true;
        }
        else {
            targetValue = false;
        }

        this.lightService
            .getCharacteristic(Characteristic.On)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateLED to ' + value);
    } catch (e) {
        this.log('updateLED Failed: ' + e);
    }
}

AirPurifier.prototype.getBuzzer = function (callback) {
    this.log('getBuzzer');

    try {

        var value = this.device.get('buzzer');

        if (value == 100) {
            return callback(null, true);
        }
        else {
            return callback(null, false);
        }


    } catch (e) {
        this.log('getBuzzer Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setBuzzer = function (targetState, callback, context) {
    this.log('setBuzzer ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == true) {
            this.device.set('buzzer', 100);
        }
        else {
            this.device.set('buzzer', 0);
        }

        callback();
    } catch (e) {
        this.log('setBuzzer Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateBuzzer = function () {

    try {
        var value = this.device.get('buzzer');
        var targetValue;

        if (value == 100) {
            targetValue = true;
        }
        else {
            targetValue = false;
        }

        this.buzzerService
            .getCharacteristic(Characteristic.On)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateBuzzer to ' + value);
    } catch (e) {
        this.log('updateBuzzer Failed: ' + e);
    }
}

AirPurifier.prototype.getFilterChangeIndication = function (callback) {
    this.log('getFilterChangeIndication');

    try {
        var value = this.device.get('filter_level');

        if (value <= 15) {
            return callback(null, Characteristic.FilterChangeIndication.CHANGE_FILTER);
        } else {
            return callback(null, Characteristic.FilterChangeIndication.FILTER_OK);
        }

    } catch (e) {
        this.log('getFilterChangeIndication Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateFilterChangeIndication = function () {

    try {
        var value = this.device.get('filter_level');

        if (value <= 15) {
            this.service.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.CHANGE_FILTER);
        } else {
            this.service.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.FILTER_OK);
        }

        this.log('updateFilterChangeIndication to ' + value);

    } catch (e) {
        this.log('updateFilterChangeIndication Failed: ' + e);
    }
}

AirPurifier.prototype.getFilterLifeLevel = function (callback) {
    this.log('getFilterLifeLevel');

    try {
        var value = this.device.get('filter_level');

        return callback(null, value);
    } catch (e) {
        this.log('getFilterLifeLevel Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateFilterLifeLevel = function () {

    try {
        var value = this.device.get('filter_level');

        this.service.setCharacteristic(Characteristic.FilterLifeLevel, value);

        this.log("updateFilterLifeLevel to " + value);

    } catch (e) {
        this.log('updateFilterLifeLevel Failed: ' + e);
    }
}

AirPurifier.prototype.getStatusActive = function (callback) {
    this.log('getStatusActive');

    try {
        var value = this.device.get('power');

        return callback(null, value);

    } catch (e) {
        this.log('getStatusActive Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateStatusActive = function () {

    try {
        var value = this.device.get('power');

        if (value == true) {
            this.airQualitySensorService.setCharacteristic(Characteristic.StatusActive, true);
            this.temperatureSensorService.setCharacteristic(Characteristic.StatusActive, true);
            this.humiditySensorService.setCharacteristic(Characteristic.StatusActive, true);
        } else {
            this.airQualitySensorService.setCharacteristic(Characteristic.StatusActive, false);
            this.temperatureSensorService.setCharacteristic(Characteristic.StatusActive, false);
            this.humiditySensorService.setCharacteristic(Characteristic.StatusActive, false);
        }

        this.log('updateStatusActive to ' + value);

    } catch (e) {
        this.log('updateStatusActive Failed: ' + e);
    }
}

AirPurifier.prototype.getAirQuality = function (callback) {
    this.log("getAirQuality");

    try {
        var value = this.device.get('aqi');
        var quality = Characteristic.AirQuality.UNKNOWN;

        if (value <= this.pm25_breakpoints[0]) { quality = Characteristic.AirQuality.EXCELLENT; }
        else if (value <= this.pm25_breakpoints[1]) { quality = Characteristic.AirQuality.GOOD; }
        else if (value <= this.pm25_breakpoints[2]) { quality = Characteristic.AirQuality.FAIR; }
        else if (value <= this.pm25_breakpoints[3]) { quality = Characteristic.AirQuality.INFERIOR; }
        else { quality = Characteristic.AirQuality.POOR; }

        return callback(null, quality);
    } catch (e) {
        this.log('getAirQuality Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateAirQuality = function () {

    try {
        var value = this.device.get('aqi');
        var quality = Characteristic.AirQuality.UNKNOWN;

        if (value <= this.pm25_breakpoints[0]) { quality = Characteristic.AirQuality.EXCELLENT; }
        else if (value <= this.pm25_breakpoints[1]) { quality = Characteristic.AirQuality.GOOD; }
        else if (value <= this.pm25_breakpoints[2]) { quality = Characteristic.AirQuality.FAIR; }
        else if (value <= this.pm25_breakpoints[3]) { quality = Characteristic.AirQuality.INFERIOR; }
        else { quality = Characteristic.AirQuality.POOR; }

        this.airQualitySensorService.setCharacteristic(Characteristic.AirQuality, quality);

        this.log("updateAirQuality to " + value);

    } catch (e) {
        this.log('updateAirQuality Failed: ' + e);
    }
}

AirPurifier.prototype.getPM2_5Density = function (callback) {
    this.log("getPM2_5Density");

    try {
        var value = this.device.get('aqi');

        return callback(null, value);
    } catch (e) {
        this.log('getAirQuality Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updatePM2_5Density = function () {

    try {
        var value = this.device.get('aqi');
        this.airQualitySensorService.setCharacteristic(Characteristic.PM2_5Density, value);

        this.log('updatePM2_5Density to ' + value);

    } catch (e) {
        this.log('updatePM2_5Density Failed: ' + e);
    }
}

AirPurifier.prototype.getTemperature = function (callback) {
    this.log("getTemperature");

    try {
        var value = this.device.get('temp');

        return callback(null, value);
    } catch (e) {
        this.log('getTemperature Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateTemperature = function () {

    try {
        var value = this.device.get('temp');
        this.temperatureSensorService.setCharacteristic(Characteristic.CurrentTemperature, value);

        this.log('updateTemperature to ' + value);

    } catch (e) {
        this.log('updateTemperature Failed: ' + e);
    }
}

AirPurifier.prototype.getHumidity = function (callback) {
    this.log("getHumidity");

    try {
        var value = this.device.get('humidity');

        return callback(null, value);
    } catch (e) {
        this.log('getHumidity Failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateHumidity = function () {

    try {
        var value = this.device.get('humidity');
        this.humiditySensorService.setCharacteristic(Characteristic.CurrentRelativeHumidity, value);

        this.log('updateHumidity to ' + value);

    } catch (e) {
        this.log('updateHumidity Failed: ' + e);
    }
}
