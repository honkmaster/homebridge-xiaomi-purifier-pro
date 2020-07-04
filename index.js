'use strict';

var Service, Characteristic, FakeGatoHistoryService;
var MiioDevice = require('./MiioAirPurifier');

var os = require("os");
var hostname = os.hostname().split(".")[0];
var version = process.env.npm_package_version;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-xiaomi-purifier-pro", "MiAirPurifierPro", AirPurifier);
}

function AirPurifier(log, config) {
    var that = this;
    this.log = log;

    this.name = config['name'];
    this.model = config['model'] || "Air Purifier";
    this.ip = config['ip'];
    this.token = config['token'];

    this.services = [];

    this.enableLED = config['enableLED'] || false;
    this.enableLEDName = config["enableLEDName"] || "LED";

    this.enableBuzzer = config['enableBuzzer'] || false;
    this.enableBuzzerName = config["enableBuzzerName"] || "Buzzer";

    this.showTemperature = config['showTemperature'] || false;
    this.showTemperatureName = config["showTemperatureName"] || "Temperature";

    this.showHumidity = config['showHumidity'] || false;
    this.showHumidityName = config["showHumidityName"] || "Humidity";

    this.showAirQuality = config['showAirQuality'] || false;
    this.showAirQualityName = config["showAirQualityName"] || "Air Quality";

    this.filterChangeAlertLevel = config['filterChangeAlertLevel'] || 15;

    this.polling_interval = config['polling_interval'] || 60000;

    if (Array.isArray(config['pm25_breakpoints']) && config['pm25_breakpoints'].length >= 4) {
        this.pm25_breakpoints = config['pm25_breakpoints'];
    }
    else {
        this.pm25_breakpoints = [5, 12, 35, 55];
    }

    if (!this.ip) {
        throw new Error('Your must provide IP address of the Air Purifier.');
    }

    if (!this.token) {
        throw new Error('Your must provide token of the Air Purifier.');
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
            that.updateHistory();
        });
    }

    if (this.showTemperature) {
        this.device.onChange('temp', value => {
            that.updateTemperature();
            that.updateHistory();
        });
    }

    if (this.showHumidity) {
        this.device.onChange('humidity', value => {
            that.updateHumidity();
            that.updateHistory();
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
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.token)
        .setCharacteristic(Characteristic.FirmwareRevision, version)

    // Air Purifier Service
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

    // Additional Services
    // LED
    if (this.enableLED) {
        this.lightService = new Service.Lightbulb(this.enableLEDName);
        this.lightService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getLED.bind(this))
            .on('set', this.setLED.bind(this));
        this.services.push(this.lightService);
    }

    // Buzzer
    if (this.enableBuzzer) {
        this.buzzerService = new Service.Switch(this.enableBuzzerName);
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

    // History
    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });
    this.services.push(this.fakeGatoHistoryService);

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
        this.log('getActive failed: ' + e);
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
        this.log('setActive failed: ' + e);
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
        this.log('updateActive failed: ' + e);
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
        this.log('getCurrentAirPurifierState failed: ' + e);
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
        this.log('updateCurrentAirPurifierState failed: ' + e);
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
        this.log('getTargetAirPurifierState failed: ' + e);
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
        this.log('setTargetAirPurifierState failed: ' + e);
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
        this.log('updateTargetAirPurifierState failed: ' + e);
    }
}

AirPurifier.prototype.getRotationSpeed = function (callback) {
    this.log('getRotationSpeed');

    try {
        var value = this.device.getSpeed();

        callback(null, value);
    } catch (e) {
        this.log('getRotationSpeed failed: ' + e);
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
        this.log('setRotationSpeed failed : ' + e);
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
        this.log('updateRotationSpeed failed : ' + e);
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
        this.log('getLockPhysicalControls failed: ' + e);
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
        this.log('setLockPhysicalControls failed: ' + e);
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
        this.log('updateLockPhysicalControls failed: ' + e);
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
        this.log('getLED failed: ' + e);
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
        this.log('setLED failed: ' + e);
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
        this.log('updateLED failed: ' + e);
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
        this.log('getBuzzer failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.setBuzzer = function (targetState, callback, context) {
    this.log('setBuzzer ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == true) {
            this.device.set('buzzer', 'on');
        }
        else {
            this.device.set('buzzer', 'off');
        }

        callback();
    } catch (e) {
        this.log('setBuzzer failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateBuzzer = function () {

    try {
        var value = this.device.get('buzzer');
        var targetValue;

        if (value == 'on') {
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
        this.log('updateBuzzer failed: ' + e);
    }
}

AirPurifier.prototype.getFilterChangeIndication = function (callback) {
    this.log('getFilterChangeIndication');

    try {
        var value = this.device.get('filter_level');

        if (value <= this.filterChangeAlertLevel) {
            return callback(null, Characteristic.FilterChangeIndication.CHANGE_FILTER);
        } else {
            return callback(null, Characteristic.FilterChangeIndication.FILTER_OK);
        }

    } catch (e) {
        this.log('getFilterChangeIndication failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateFilterChangeIndication = function () {
    try {
        var value = this.device.get('filter_level');

        if (value <= this.filterChangeAlertLevel) {
            this.service.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.CHANGE_FILTER);
        } else {
            this.service.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.FILTER_OK);
        }

        this.log('updateFilterChangeIndication to ' + value);
    } catch (e) {
        this.log('updateFilterChangeIndication failed: ' + e);
    }
}

AirPurifier.prototype.getFilterLifeLevel = function (callback) {
    this.log('getFilterLifeLevel');

    try {
        var value = this.device.get('filter_level');

        return callback(null, value);
    } catch (e) {
        this.log('getFilterLifeLevel failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateFilterLifeLevel = function () {

    try {
        var value = this.device.get('filter_level');

        this.service.setCharacteristic(Characteristic.FilterLifeLevel, value);

        this.log("updateFilterLifeLevel to " + value);
    } catch (e) {
        this.log('updateFilterLifeLevel failed: ' + e);
    }
}

AirPurifier.prototype.getStatusActive = function (callback) {
    this.log('getStatusActive');

    try {
        var value = this.device.get('power');

        return callback(null, value);
    } catch (e) {
        this.log('getStatusActive failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateStatusActive = function () {
    try {
        var value = this.device.get('power');

        var targetValue;
        if (value == true) {
            targetValue = true;
        }
        else {
            targetValue = false;
        }

        this.airQualitySensorService.setCharacteristic(Characteristic.StatusActive, targetValue);
        this.temperatureSensorService.setCharacteristic(Characteristic.StatusActive, targetValue);
        this.humiditySensorService.setCharacteristic(Characteristic.StatusActive, targetValue);

        this.log('updateStatusActive to ' + value);
    } catch (e) {
        this.log('updateStatusActive failed: ' + e);
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
        this.log('getAirQuality failed: ' + e);
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
        this.log('updateAirQuality failed: ' + e);
    }
}

AirPurifier.prototype.getPM2_5Density = function (callback) {
    this.log("getPM2_5Density");

    try {
        var value = this.device.get('aqi');

        return callback(null, value);
    } catch (e) {
        this.log('getAirQuality failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updatePM2_5Density = function () {
    try {
        var value = this.device.get('aqi');
        this.airQualitySensorService.setCharacteristic(Characteristic.PM2_5Density, value);

        this.log('updatePM2_5Density to ' + value);
    } catch (e) {
        this.log('updatePM2_5Density failed: ' + e);
    }
}

AirPurifier.prototype.getTemperature = function (callback) {
    this.log("getTemperature");

    try {
        var value = this.device.get('temp');

        return callback(null, value);
    } catch (e) {
        this.log('getTemperature failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateTemperature = function () {
    try {
        var value = this.device.get('temp');
        this.temperatureSensorService.setCharacteristic(Characteristic.CurrentTemperature, value);

        this.log('updateTemperature to ' + value);
    } catch (e) {
        this.log('updateTemperature failed: ' + e);
    }
}

AirPurifier.prototype.getHumidity = function (callback) {
    this.log("getHumidity");

    try {
        var value = this.device.get('humidity');

        return callback(null, value);
    } catch (e) {
        this.log('getHumidity failed: ' + e);
        callback(e);
    }
}

AirPurifier.prototype.updateHumidity = function () {
    try {
        var value = this.device.get('humidity');
        this.humiditySensorService.setCharacteristic(Characteristic.CurrentRelativeHumidity, value);

        this.log('updateHumidity');
    } catch (e) {
        this.log('updateHumidity failed: ' + e);
    }
}

AirPurifier.prototype.updateHistory = function () {
    try {
        this.fakeGatoHistoryService.addEntry({
            time: new Date().getTime() / 1000,
            temp: this.device.get('temp'),
            humidity: this.device.get('humidity'),
            ppm: this.device.get('aqi')
        });

        this.log('updateHistory');
    } catch (e) {
        this.log('updateHistory failed: ' + e);
    }
}

