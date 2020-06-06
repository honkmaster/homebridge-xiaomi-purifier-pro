var miio = require('miio');

class MiioDevice {
    constructor(token, ip) {
        this.ip = ip;
        this.token = token;
        this.properties = [];
        this.onChangeCallbacks = [];
        this.isResponding = false;

        this.connect();
    }

    trackProperty(prop) {
        if (!this.isPropertyTracked(prop)) {
            this.properties.push({
                "prop": prop,
                "value": null
            });
        }
    }

    isPropertyTracked(prop) {
        var tracked = false;

        for (var i = 0; i < this.properties.length; i++) {
            if (this.properties[i].prop == prop) {
                tracked = true;
                break;
            }
        }

        return tracked;
    }

    getProperty(prop) {
        if (!this.isResponding) {
            throw 'MiioDevice is not responding';
        }

        if (!this.isPropertyTracked(prop)) {
            throw 'MiioDevice property is not tracked.';
        }

        var value = null;

        for (var i = 0; i < this.properties.length; i++) {
            if (this.properties[i].prop == prop) {

                value = this.properties[i].value;
                break;
            }
        }

        if (value == null) {
            throw 'MiioDevice property has unknown value.';
        }

        return value;
    }

    setProperty(prop, targetValue) {
        if (!this.isResponding) {
            throw 'MiioDevice is not responding';
        }
        var value = null;

        for (var i = 0; i < this.properties.length; i++) {
            if (this.properties[i].prop == prop) {
                value = this.properties[i].value;
                break;
            }
        }

        if (value == targetValue) {
            return;
        }

        if (prop == 'power') {
            this.device.setPower(targetValue).then(result => {
                this.pollProperties();
            });
        }
        else if (prop == 'mode') {
            this.device.changeMode(targetValue).then(result => {
                this.pollProperties();
            });
        }
        else if (prop == 'led') {
            this.device.led([targetValue]).then(result => {
                this.pollProperties();
            });
        }
        else if (prop == 'volume') {
            this.device.setVolume(targetValue).then(result => {
                this.pollProperties();
            });
        }
        else if (prop == 'childLock') {
            this.device.setChildLock(targetValue).then(result => {
                this.pollProperties();
            });
        }
        else if (prop == 'favoriteLevel') {
            this.device.setFavoriteLevel(targetValue).then(result => {
                this.pollProperties();
            })
        }
    }

    onChangeProperty(prop, callback) {
        var onChangeCallback = {
            prop: prop,
            callback: callback
        }

        this.onChangeCallbacks.push(onChangeCallback);
    }

    triggerOnChangeCallbacks(prop, newValue) {
        this.onChangeCallbacks.forEach(onChangeCallback => {
            if (onChangeCallback.prop == prop) {
                onChangeCallback.callback(newValue);
            }
        });
    }

    pollProperties() {
        if (!this.device) {
            throw 'MiioDevice is not connected';
        }

        var that = this;

        try {
            // zhimi.airpurifier.v7 doesn't return volume in properties,
            // need to get this seperately.
            this.device.call('get_prop', ['volume']).then(result => {
                var response = this.device.miioProperties();

                var parsedResponse = JSON.parse(JSON.stringify(response));
                parsedResponse['volume'] = result[0];
                response = parsedResponse;


                this.isResponding = true;
                var changedIndexes = [];

                // push any changed properties
                for (var key in response) {
                    this.properties.forEach((trackedProperty, i) => {
                        if (key != trackedProperty.prop) {
                            return;
                        }

                        if (response[key] != trackedProperty.value) {
                            changedIndexes.push(i);
                        }

                        // map responses to properties dictionary
                        trackedProperty.value = response[key];
                    });
                };

                changedIndexes.forEach(i => {

                    var property = that.properties[i];
                    
                    that.triggerOnChangeCallbacks(property.prop, property.value);
                });
            });

        }
        catch (error) {
            console.log('Miio Device (ip: ' + that.ip + ') poll error : ' + error);
            this.isResponding = false;
        }
    }

    connect() {
        var that = this;

        miio.device({ address: this.ip, token: this.token })
            .then(device => {
                console.log('Miio Device (ip: ' + that.ip + ') is now connected');
                that.device = device;
                this.pollProperties();
            })
            .catch(error => {
                console.log('Miio Device (ip: ' + that.ip + ') failed to connect:' + error);
                setTimeout(function () {
                    that.connect();
                }, 30000);
            });
    }
}

module.exports = MiioDevice