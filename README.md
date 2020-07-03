[![npm version](https://badge.fury.io/js/homebridge-xiaomi-purifier-pro.svg)](https://badge.fury.io/js/homebridge-xiaomi-purifier-pro)

# homebridge-xiaomi-purifier-pro

![mi-air-purifier](https://imgaz.staticbg.com/thumb/large/oaupload/ser1/banggood/images/55/22/4e668990-f7be-4361-8626-06d87f4e4cb7.jpg)

### Features

* Switch on / off.
* Switch auto / manual mode.
* Change fan rotation speed.
* Switch child lock on / off.
* Switch LED light on / off.
* Switch buzzer sound on / off.
* Display temperature.
* Display humidity.
* Display air quality.
* Display filter state.

### Installation

1. Install required packages.

``` 
	npm install -g homebridge-xiaomi-purifier-pro
	```

2. Make sure your Homebridge server is same network with your device, then run following command to discover the token.

``` 
	miio discover --sync
	```

3. You may need to wait few minutes until you get the response similar to below:

``` 
	Device ID: 49466088
	Model info: Unknown
	Address: 192.168.1.8
	Token: 6f7a65786550386c700a6b526666744d via auto-token
	Support: Unknown
	```

4. Record down the `Address` and `Token` values as we need it in our configuration file later.

5. If you are getting `??????????????` for your token value, please reset your device and connect your Homebridge server directly to the access point advertised by the device.

6. Then run the command again.

``` 
	miio discover --sync
	```

7. Add following accessory to the `config.json` .

``` 
		"accessories": [
			{
				"accessory": "MiAirPurifierPro",
				"name": "Bed Room Air Purifier",
				"ip": "192.168.1.x",
				"token": "xxxxxxxxxxxxxxxxxxx",		
			    "enableLED": true (optional),
				"enableLEDName": "Some custom LED name" (optional),
				"enableBuzzer": true (optional),
				"enableBuzzerName": "Some custom buzzer name" (optional),				
				"showTemperature": true,
                "showTemperatureName": "Some custom Temperature name" (optional),
                "showHumidity": true (optional),
                "showHumidityName": "Some custom Humidity name" (optional),
                "showAirQuality": true (optional),
                "showAirQualityName": "Some custom Air Quality name" (optional),
				"pm25_breakpoints": [5, 12, 35, 55] (optional),
				"polling_interval": 60000 (optional)
			}
		]
	```

	**Notes:** Set value for `enableLED` , `enableBuzzer` , `showTemperature` , `showHumidity` , `showAirQuality`  to **true** or **false** to show or hide these sensors in Home app.

8. Restart Homebridge, and your device will be added to Home app.

# License

MIT License
