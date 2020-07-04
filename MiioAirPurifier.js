var MiioDevice = require('./MiioDevice');

class MiioAirPurifier extends MiioDevice {
    constructor(token, ip) {
        super(token, ip);

        this.dictionary = {
            'power': ['power'], // bool            
            'mode': ['mode'], // Mode : 0(Auto), 1(Sleep), 2(Favorite), 3(None)
            'aqi': ['aqi'], // PM2.5 Density : 0-600 1
            'humidity': ['humidity'], // Relative Humidity: 0-100(Percentage)
            'temp': ['temperature'], // Temperature: -40-125 0.1
            'filter_level': ['filterLifeRemaining'], // Filter Live Level : 0-100(Percentage)
            'child_lock': ['childLock'], // Physical Control Locked : bool
            'led': ['led'], // bool      
            'buzzer': ['volume'], // bool
            'favorite_level': ['favoriteLevel'] // 1 - 16
        }

        for (var propertyName in this.dictionary) {
            this.trackProperty(this.dictionary[propertyName][0]);
        };
    }

    get(propertyName) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MiioDevice property \'' + propertyName + '\' is not defined';
        }

        return this.getProperty(this.dictionary[propertyName][0]);
    }

    set(propertyName, value) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MiioDevice property \'' + propertyName + '\' is not defined';
        }

        this.setProperty(this.dictionary[propertyName][0], value);
    }

    onChange(propertyName, callback) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MiioDevice property \'' + propertyName + '\' is not defined';
        }

        this.onChangeProperty(this.dictionary[propertyName][0], callback);
    }

    getSpeed() {
        var favorite_level = this.get('favorite_level');
        const rotationSpeed = (favorite_level / 16) * 100;

        return Math.round(rotationSpeed);
    }

    setSpeed(speed) {
        const favorite_level = (speed / 100) * 16;
        this.set('favorite_level', favorite_level);
    }
}

module.exports = MiioAirPurifier
