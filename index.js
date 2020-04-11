'use strict';

const miio = require('miio');
const version = require('./package.json').version;
let Service;
let Characteristic;
let logger;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory('homebridge-xiaomi-purifier-3', 'MiAirPurifier3', MiAirPurifier3);
}

function MiAirPurifier3(log, config) {
	logger = log;

	this.services = [];
	this.name = config.name || 'Air Purifier';
	this.ip = config.ip;
	this.token = config.token;
	this.did = config.did;
	this.showAirQuality = config.showAirQuality || false;
	this.showTemperature = config.showTemperature || false;
	this.showHumidity = config.showHumidity || false;
	this.enableLED = config.enableLED || false;
	this.enableBuzzer = config.enableBuzzer || false;
	this.device = undefined;
	this.mode = undefined;
	this.temperature = undefined;
	this.humidity = undefined;
	this.aqi = undefined;
	
	//Korea PM 2.5 standard value
	this.levels = [
		[76, Characteristic.AirQuality.POOR],
		[36, Characteristic.AirQuality.INFERIOR],
		[16, Characteristic.AirQuality.FAIR],
		[6, Characteristic.AirQuality.GOOD],
		[0, Characteristic.AirQuality.EXCELLENT]
	];

	if (!this.ip) {
		throw new Error('Your must provide IP address of the Air Purifier.');
	}

	if (!this.token) {
		throw new Error('Your must provide token of the Air Purifier.');
	}

	this.service = new Service.AirPurifier(this.name);
	this.service.addOptionalCharacteristic(Characteristic.FilterLifeLevel);
	this.service.addOptionalCharacteristic(Characteristic.FilterChangeIndication);

	this.service
		.getCharacteristic(Characteristic.Active)
		.on('get', this.getActiveState.bind(this))
		.on('set', this.setActiveState.bind(this));

	this.service
		.getCharacteristic(Characteristic.CurrentAirPurifierState)
		.on('get', this.getCurrentAirPurifierState.bind(this));

	this.service
		.getCharacteristic(Characteristic.TargetAirPurifierState)
		.on('get', this.getTargetAirPurifierState.bind(this))
		.on('set', this.setTargetAirPurifierState.bind(this));

	this.service
		.getCharacteristic(Characteristic.LockPhysicalControls)
		.on('get', this.getLockPhysicalControls.bind(this))
		.on('set', this.setLockPhysicalControls.bind(this));

	this.service
		.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', this.getRotationSpeed.bind(this))
		.on('set', this.setRotationSpeed.bind(this));

	this.service
		.getCharacteristic(Characteristic.FilterLifeLevel)
		.on('get', this.getFilterState.bind(this));

	this.service
		.getCharacteristic(Characteristic.FilterChangeIndication)
		.on('get', this.getFilterChangeState.bind(this));

	this.serviceInfo = new Service.AccessoryInformation();

	this.serviceInfo
		.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
		.setCharacteristic(Characteristic.Model, 'Air Purifier 3')
		.setCharacteristic(Characteristic.SerialNumber, this.token.toUpperCase())
		.setCharacteristic(Characteristic.FirmwareRevision, version);

	this.services.push(this.service);
	this.services.push(this.serviceInfo);

	if (this.showAirQuality) {
		this.airQualitySensorService = new Service.AirQualitySensor(this.name + ' Air Quality');

		this.airQualitySensorService
			.getCharacteristic(Characteristic.AirQuality)
			.on('get', this.getAirQuality.bind(this));

		this.airQualitySensorService
			.getCharacteristic(Characteristic.PM2_5Density)
			.on('get', this.getPM25.bind(this));

		this.services.push(this.airQualitySensorService);
	}

	if (this.showTemperature) {
		this.temperatureSensorService = new Service.TemperatureSensor(this.name + ' Temperature');

		this.temperatureSensorService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getTemperature.bind(this));

		this.services.push(this.temperatureSensorService);
	}

	if (this.showHumidity) {
		this.humiditySensorService = new Service.HumiditySensor(this.name + ' Humidity');

		this.humiditySensorService
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on('get', this.getHumidity.bind(this));

		this.services.push(this.humiditySensorService);
	}

	if (this.enableLED) {
		this.lightBulbService = new Service.Lightbulb(this.name + ' LED');

		this.lightBulbService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getLED.bind(this))
			.on('set', this.setLED.bind(this));

		this.services.push(this.lightBulbService);
	}

	if (this.enableBuzzer) {
		this.switchService = new Service.Switch(this.name + ' Buzzer');

		this.switchService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getBuzzer.bind(this))
			.on('set', this.setBuzzer.bind(this));

		this.services.push(this.switchService);
	}

	this.discover();
}

MiAirPurifier3.prototype = {
	discover: function () {
		const that = this;

		miio.device({
			address: that.ip,
			token: that.token
		})
			.then(device => {
				/*
				MiioDevice {
					model=zhimi.airpurifier.v6,
					types=miio:air-purifier, sensor, miio, air-purifier,
					capabilities=miio:buzzer, miio:led-brightness, miio:switchable-led, pm2.5, relative-humidity, temperature, switchable-mode, mode, switchable-power, restorable-state, power, state
				}
				*/
				if (device.matches('type:air-purifier')) {
					that.device = device;

					logger.debug('Discovered Mi Air Purifier (%s) at %s', device.miioModel, that.ip);
					logger.debug('Model       : ' + device.miioModel);
					logger.debug('Power       : ' + device.property('power')['value']);
					logger.debug('Mode        : ' + device.property('mode')['value']);
					logger.debug('Temperature : ' + device.property('temperature')['value']);
					logger.debug('Humidity    : ' + device.property('humidity')['value']);
					logger.debug('Air Quality : ' + device.property('aqi')['value']);
					logger.debug('LED         : ' + device.property('led_brightness')['value']);


					// 	'power'        : [ 2,  2], // 
					// 	'fan_level'    : [ 2,  4], // Fan Level : 1(Level 1), 2(Level 2), 3(Level 3)
					// 	'mode'         : [ 2,  5], // Mode : 0(Auto), 1(Sleep), 2(Favorite), 3(None)
					// 	'pm25'         : [ 3,  6], // PM2.5 Density : 0-600 1
					// 	'humidity'     : [ 3,  7], // Relative Humidity: 0-100(Percentage)
					// 	'temp'         : [ 3,  8], // Temperature: -40-125 0.1
					// 	'filter_level' : [ 4,  3], // Filter Live Level : 0-100(Percentage)
					// 	'lock'         : [ 7,  1], // Physical Control Locked : bool
					// 	'speed_write'  : [10,  8], // motor1-speed : 0-3000 : 0-3000 1
					// 	'speed_read'   : [10,  9], // motor1-speed : 0-3000 : 0-3000 1
					// 	'aqi_heartbeat': [13,  9]  // aqi-updata-heartbeat: 0 - 65534


					// Listen to air quality change event
					if (that.showAirQuality) {
						device.on('pm2.5Changed', value => {
							logger.debug('pm2.5 changed to ' + value);

							that.updateAirQuality(value);
						});
					}

					// Listen to temperature change event
					if (that.showTemperature) {
						// Read the temperature
						device.temperature()
							.then(temperature => {
								that.updateTemperature(temperature.celsius);
							})
							.catch(error => {
								logger.debug(error);
							});
						device.on('temperatureChanged', temperature => {
							logger.debug('temperature changed to ' + temperature.celsius);
							that.updateTemperature(temperature.celsius);
						});
					}

					// Listen to humidity change event
					if (that.showHumidity) {
						// Read the relative humidity
						device.relativeHumidity()
							.then(result => {
								that.updateHumidity(result);
							})
							.catch(error => {
								logger.debug(error);
							});
						device.on('relativeHumidityChanged', value => {
							logger.debug('relative humidity changed to ' + value);
							that.updateHumidity(value);
						});
					}
				} else {
					logger.debug('Device discovered at %s is not Mi Air Purifier', this.ip);
				}
			})
			.catch(error => {
				logger.debug('Failed to discover Mi Air Purifier at %s', this.ip);
				logger.debug('Will retry after 30 seconds');

				setTimeout(function () {
					that.discover();
				}, 30000);
			});
	},

	getActiveState: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		this.device.call("get_properties", [{ "did": this.did, "siid": 2, "piid": 2 }])
			.then(result => {
				const isOn = result[0]['value'];
				logger.debug('getActiveState: %s', isOn ? 'ON' : 'OFF');

				if (isOn) {
					callback(null, Characteristic.Active.ACTIVE);
				} else {
					callback(null, Characteristic.Active.INACTIVE);
				}

			})
			.catch(error => {
				callback(error);
			});
	},

	setActiveState: function (state, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('setActiveState: %s', state == Characteristic.Active.ACTIVE ? 'ON' : 'OFF');

		this.device.changePower(state)
			.then(isOn => {

				if (state == Characteristic.Active.ACTIVE) {
					this.service.getCharacteristic(Characteristic.CurrentAirPurifierState).updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
					this.service.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.ACTIVE);
					this.service.getCharacteristic(Characteristic.TargetAirPurifierState).updateValue(Characteristic.TargetAirPurifierState.AUTO);

				}
				else {
					this.service.getCharacteristic(Characteristic.CurrentAirPurifierState).updateValue(Characteristic.CurrentAirPurifierState.INACTIVE);
					this.service.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
				}

				callback(null);
			})
			.catch(error => {
				callback(error);
			});
	},

	getCurrentAirPurifierState: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		this.device.call("get_properties", [{ "did": this.did, "siid": 2, "piid": 2 }])
			.then(result => {
				// HomeKit
				// INACTIVE = 0
				// IDLE = 1
				// PURIFYING_AIR = 2

				// Miio
				// On = true
				// Off = false
				const isOn = result[0]['value'];
				logger.debug('getCurrentAirPurifierState: %s', isOn ? 'PURIFYING_AIR' : 'INACTIVE');

				if (isOn) {
					callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
				} else {
					callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
				}
			})
			.catch(error => {
				callback(error);
			});
	},

	getTargetAirPurifierState: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		this.device.call("get_properties", [{ "did": this.did, "siid": 2, "piid": 5 }])
			.then(result => {
				// HomeKit
				// AUTO = 1
				// MANUAL = 0

				// Miio 
				// auto = 0
				// favorite = 2
				const mode = result[0]['value'];

				logger.debug('getTargetAirPurifierState: ' + (mode == 0 ? 'AUTO' : 'MANUAL'));

				if (mode == 0) {
					callback(null, Characteristic.TargetAirPurifierState.AUTO);
				} else {
					callback(null, Characteristic.TargetAirPurifierState.MANUAL);
				}
			})
			.catch(error => {
				callback(error);
			});
	},

	setTargetAirPurifierState: function (state, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('setTargetAirPurifierState: %s', state == Characteristic.TargetAirPurifierState.AUTO ? 'AUTO' : 'MANUAL');

		const mode = (state == Characteristic.TargetAirPurifierState.AUTO) ? 'auto' : 'favorite';

		this.device.changeMode(mode)
			.then(result => {
				// HomeKit
				// AUTO = 1
				// MANUAL = 0

				// Miio
				// auto = 0
				// favorite = 2

				this.service.getCharacteristic(Characteristic.CurrentAirPurifierState).updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
				this.service.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.ACTIVE);

				this.device.call("get_properties", [{ "did": this.did, "siid": 10, "piid": 10 }]).then(result => {
					const favorite_level = parseInt(result[0]['value']);

					const rotationSpeed = (favorite_level / 14) * 100;

					logger.debug('getRotationSpeed: ' + rotationSpeed + ' favorite_level: ' + favorite_level);

					this.service.getCharacteristic(Characteristic.RotationSpeed).updateValue(rotationSpeed);

					callback(null);
				}).catch(error => {
					callback(error);
				});


			})
			.catch(error => {
				callback(error);
			});
	},

	getRotationSpeed: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		this.device.call("get_properties", [{ "did": this.did, "siid": 10, "piid": 10 }]).then(result => {
			const favorite_level = parseInt(result[0]['value']);

			const rotationSpeed = (favorite_level / 14) * 100;

			logger.debug('getRotationSpeed: ' + rotationSpeed + ' favorite_level: ' + favorite_level);

			callback(null, rotationSpeed);
		}).catch(error => {
			callback(error);
		});
	},

	setRotationSpeed: function (speed, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		if (speed > 0) {

			const favorite_level = (speed / 100) * 14;

			logger.debug('setRotationSpeed: ' + speed + ' favorite_level: ' + favorite_level);

			this.device.call("set_properties", [{ "did": this.did, "siid": 10, "piid": 10, "value": favorite_level }])
				.then()
				.catch(err => {
					callback(err);
				});
		}

		callback(null);
	},

	getLockPhysicalControls: async function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		await this.device.call("get_properties", [{ "did": this.did, "siid": 7, "piid": 1 }])
			.then(result => {
				const child_lock = result[0]['value'];
				const state = child_lock ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;

				logger.debug('getLockPhysicalControls: %s', state ? 'CONTROL_LOCK_ENABLED' : 'CONTROL_LOCK_DISABLED');

				callback(null, state);
			})
			.catch(error => {

				callback(error);
			});
	},

	setLockPhysicalControls: async function (state, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('setLockPhysicalControls: %s', state ? 'CONTROL_LOCK_ENABLED' : 'CONTROL_LOCK_DISABLED');

		await this.device.changeChildLock(state)
			.then(result => {
				callback(null);
			})
			.catch(error => {
				callback(error);
			});
	},

	getFilterState: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}
		this.device.call("get_properties", [{ "did": this.did, "siid": 4, "piid": 3 }]).then(result => {
			const filter_level = result[0]["value"];
			callback(null, filter_level);
		}).catch(error => {
			callback(error);
		});
	},

	getFilterChangeState: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}
		this.device.call("get_properties", [{ "did": this.did, "siid": 4, "piid": 3 }]).then(result => {
			const filter_level = result[0]["value"];
			callback(null, filter_level < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
		}).catch(error => {
			callback(error);
		});
	},

	getAirQuality: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('getAirQuality: %s', this.aqi);

		for (var item of this.levels) {
			if (this.aqi >= item[0]) {
				callback(null, item[1]);
				return;
			}
		}
	},

	updateAirQuality: function (value) {
		if (!this.showAirQuality) {
			return;
		}

		this.aqi = value;

		logger.debug('updateAirQuality: %s', value);

		this.updatePM25(value);

		for (var item of this.levels) {
			if (value >= item[0]) {
				this.airQualitySensorService.getCharacteristic(Characteristic.AirQuality).updateValue(item[1]);
				return;
			}
		}
	},

	getPM25: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('getPM25: %s', this.aqi);

		callback(null, this.aqi);
	},

	updatePM25: function (value) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('updatePM25: %s', value);

		this.airQualitySensorService.getCharacteristic(Characteristic.PM2_5Density).updateValue(value);
	},

	getTemperature: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('getTemperature: %s', this.temperature);

		callback(null, this.temperature);
	},

	updateTemperature: function (value) {
		if (!this.showTemperature) {
			return;
		}

		this.temperature = value;

		logger.debug('updateTemperature: %s', value);

		this.temperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(value);
	},

	getHumidity: function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('getHumidity: %s', this.humidity);

		callback(null, this.humidity);
	},

	updateHumidity: function (value) {
		if (!this.showHumidity) {
			return;
		}

		this.humidity = value;

		logger.debug('updateHumidity: %s', value);

		this.humiditySensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(value);
	},

	getLED: async function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		// bright = 0
		// dim = 1
		// off = 2

		const result = await this.device.call("get_properties", [{ "did": this.did, "siid": 6, "piid": 1 }]).catch(error => { callback(error); });

		const isOn = result[0]['value'] == 2 ? false : true;
		logger.debug('getLED: %s', isOn ? "ON" : "OFF");

		callback(null, isOn);
	},

	setLED: async function (state, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		// bright = 0
		// dim = 1
		// off = 2

		logger.debug('setLED: %s', state ? 'ON' : 'OFF');

		const brightness = state ? 'bright' : 'off';

		await this.device.changeLEDBrightness(brightness)
			.then(state => {
				callback(null);
			})
			.catch(error => {
				callback(error);
			});
	},

	getBuzzer: async function (callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		const result = await this.device.call("get_properties", [{ "did": this.did, "siid": 5, "piid": 1 }]).catch(error => { callback(error); });
		const buzzer = result[0]['value']

		logger.debug('getBuzzer: %s', buzzer ? 'ON' : 'OFF');

		callback(null, buzzer);
	},

	setBuzzer: async function (state, callback) {
		if (!this.device) {
			callback(new Error('No Air Purifier is discovered.'));
			return;
		}

		logger.debug('setBuzzer: %s', state ? 'ON' : 'OFF');

		await this.device.changeBuzzer(state)
			.then(state => {
				callback(null);
			})
			.catch(error => {
				logger.debug('setBuzzer:' + error);
				callback(error);
			});
	},

	identify: function (callback) {
		callback();
	},

	getServices: function () {
		return this.services;
	}
};