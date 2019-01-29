const FastSpeedtest = require("fast-speedtest-api");
const telegraf = require('telegrafjs');


let speedtest = new FastSpeedtest({
    token: process.env.TOKEN, // required
    verbose: false, // default: false
    timeout: 10000, // default: 5000
    https: true, // default: true
    urlCount: 5, // default: 5
    bufferSize: 8, // default: 8
    unit: FastSpeedtest.UNITS.MBps // default: Bps
});

var output = console.log;

if (typeof process.env.TELEGRAF_HOST != 'undefined') {
    output = (d)=>{
        let tags = {};
        if (typeof process.env.LOCATION != 'undefined')
            tags = {location: process.env.LOCATION};

        let m1 = new telegraf.Measurement(
            "fast-speedtest",
            tags,
            {
                download: new telegraf.Float(d)
            }
        );
        if (process.env.DEBUG) console.log(m1);
        let client = new telegraf.TelegrafUDPClient({
            host: process.env.TELEGRAF_HOST,
            port: process.env.TELEGRAF_PORT||8092,
        });
        client.connect()
            .then(() => {
                return client.sendMeasurement(m1);
            })
            .then(() => {
                client.close();
            });
    };
}

function runSpeedTest(){
    speedtest.getSpeed().then(s => {
        output(s);
    }).catch(e => {
        console.error(e.message);
    });
}
runSpeedTest();
setInterval( runSpeedTest , parseInt(process.env.INTERVAL, 10)*1000 );
