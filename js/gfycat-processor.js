/**
 * Created by daffinito on 12/24/15.
 */
var https = require('https');

module.exports = {
    process: function (file, uri, callback) {
        var json = '', resp = {
            'file': file,     // filename
            'uri': uri,       // uri to process
            'type': '',       // webm or mp4
            'bytes': 0,       // bytes downloaded
            'dluri': ''       // uri to download from
        }, options = {      // options for http request for gfycat api
            hostname: 'gfycat.com',
            port: 443,
            path: '/cajax/get/' + uri.split('/').slice(-1),  // takes the id from the end of the uri
            method: 'GET'
        };
        var req = https.request(options, function (res) {
            res.on('data', function (d) {
                resp.bytes += d.length;        // keep track of how many bytes are being downloaded
                json += d;             // get json from gfycat
            });
            res.on('end', function () {   // finished getting gfycat json
                try {
                    var resjson = JSON.parse(json);   // parse the json
                }
                catch (e) {    // if there's an error parsing, callback with error
                    if (callback) callback(true, "Failed to parse gfycat json " + uri + ": " + e);
                }
                if (resjson.gfyItem.webmUrl) {   // first look for webm
                    resp.type = 'webm';
                    resp.dluri = resjson.gfyItem.webmUrl;
                    if (callback) callback(false, resp);
                } else if (resjson.gfyItem.mp4url) {   // next look for mp4
                    resp.type = 'mp4';
                    resp.dluri = resjson.gfyItem.mp4Url;
                    if (callback) callback(false, resp);
                } else if (callback) callback(true, "Unable to locate webm or mp4 url in gfycat json: " + uri);  // otherwise fail
            });
        }).on('error', function (e) {
            if (callback) callback(true, "Error downloading gfycat JSON: " + uri + " e: " + e); // return error if download fails
        });
        req.end();
    }
};