const http = require('http');
const os = require('os');
const fs = require('fs');
const dns = require('dns');

const datafile = "/var/data/kubia.txt";
const serviceName = "kubia.default.svc.cluster.local";
const port = 8080;

function fileExists(file) {
    try {
        fs.statSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

function httpGet(reqOptions, callback) {
    return http.get(reqOptions, function (response) {
        var body = '';
        response.on('data', function (d) { body += d; });
        response.on('end', function () { callback(body); });
    }).on('error', function (e) {
        callback("Error: " + e.message);
    });
}

console.log("Kubia server starting...");
var handler = function (request, response) {
    if (request.method == 'POST') {
        var file = fs.createWriteStream(datafile);
        file.on('open', function (fd) {
            request.pipe(file);
            console.log("New data has been received and stored.");
            response.writeHead(200);
            response.end("Data stored on pod " + os.hostname() + "\n");
        });
    } else {
        response.writeHead(200);
        if (request.url == '/data') {
            var data = fileExists(datafile) ? fs.readFileSync(datafile, 'utf8') : "No data posted yet";
            response.end(data);
        } else {
            response.write("you've hit " + os.hostname() + "\n");
            response.write("Data stored on this cluster:\n");
            dns.resolveSrv(serviceName, function (err, addresses) {
                if (err) {
                    response.end("Could not lookup DNS SRV records: " + err);
                    return;
                }
                var numResponses = 0;
                if (addresses.length == 0) {
                    response.end("No peers discovered.");
                } else {
                    console.log("found dns " + addresses.length + " addresses");
                    addresses.forEach(function (item) {
                        var requestOptiopns = {
                            host: item.name,
                            port: port,
                            path: '/data'
                        };
                        httpGet(requestOptiopns, function (returnedData) {
                            numResponses++;
                            response.write("- " + item.name + ": " + returnedData + "\n");
                            if (numResponses == addresses.length) {
                                response.end();
                            }
                        });
                    });
                }
            });
        }
    }
};

var www = http.createServer(handler);
www.listen(8080);
