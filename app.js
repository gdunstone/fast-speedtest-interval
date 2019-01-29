const FastSpeedtest = require("fast-speedtest-api");

const telegraf = require('telegrafjs');
const https = require('https');

var output = (fast_com_result, speedtest_net_result) => {

    let m = {};
    if (fast_com_result != null)
        m["fast_download"] = fast_com_result;
    if (speedtest_net_result != null){
        m["ookla_download"] = speedtest_net_result['speeds']['download'];
        m["ookla_upload"] = speedtest_net_result['speeds']['upload'];
        m["ookla_ping"] = speedtest_net_result['server']['ping'];
        m["ookla_distance"] = speedtest_net_result['server']['distance'];
    }
    console.log(JSON.stringify(m));
};

if (typeof process.env.TELEGRAF_HOST != 'undefined') {
    output = (fast_com_result, speedtest_net_result)=>{
        let tags = {};
        if (typeof process.env.LOCATION != 'undefined')
            tags = {location: process.env.LOCATION};
        let m = {};

        if (fast_com_result != null)
            m["fast_download"] = telegraf.Float(fast_com_result);
        if (speedtest_net_result != null){
            m["ookla_download"] = telegraf.Float(speedtest_net_result['speeds']['download']);
            m["ookla_upload"] = telegraf.Float(speedtest_net_result['speeds']['upload']);
            m["ookla_ping"] = telegraf.Float(speedtest_net_result['server']['ping']);
            m["ookla_distance"] = telegraf.Float(speedtest_net_result['server']['distance']);
        }

        let m1 = new telegraf.Measurement(
            "fast-speedtest",
            tags,
            m
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


function init(token){

    function runSpeedTest(){
        SKIP_FAST = typeof process.env.SKIP_FAST != 'undefined';
        SKIP_OOKLA = typeof process.env.SKIP_OOKLA != 'undefined';
        if (SKIP_FAST && SKIP_OOKLA) return;
        else if (SKIP_OOKLA && !SKIP_FAST){
            fast_com.getSpeed().then(s => {
                output(s, null);
            }).catch(e => {
                console.error(e.message);
            });
        }
        else if (!SKIP_OOKLA && SKIP_FAST){
            speedtest_net({maxTime: 5000}).on('data', data => {
                output(null, data);
            });
        }
        else {
            fast_com.getSpeed().then(s => {
            speedtest_net({maxTime: 5000}).on('data',data => {
                output(s, data);    
            });
            
            }).catch(e => {
                console.error(e.message);
            });
        }   
    }

    console.log(`using token: ${token}`)

    let fast_com = new FastSpeedtest({
        token: token, // required
        verbose: false, // default: false
        timeout: 10000, // default: 5000
        https: true, // default: true
        urlCount: 16, // default: 5
        bufferSize: 12, // default: 8
        unit: FastSpeedtest.UNITS.Mbps // default: Bps
    });
    
    var speedtest_net = require('speedtest-net');
    runSpeedTest();
    setInterval( runSpeedTest , parseInt(process.env.INTERVAL, 10)*1000 );
}

if (typeof process.env.TOKEN == 'undefined'){
    
    https.get('https://fast.com', (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        let r = /(app-.*\.js)/g.exec(data);
        if (r != null){
            https.get(`https://fast.com/${r[1]}`, (resp) => {
              let data2 = '';

                // A chunk of data has been recieved.
                resp.on('data', (chunk) => {
                    data2 += chunk;
                });
                resp.on('end', () => {
                    let r2 = /token:\"(.{32})/g.exec(data2);
                    if (r2 != null) {
                        init(r2[1]);
                    }
                });

            }).on("error", (err) => {
                console.log(`Error: ${err.message}`);
            });
        }
      });

    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
}else{
    init(process.env.TOKEN);
}
