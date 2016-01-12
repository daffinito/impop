/**
 * Created by daffinito on 1/10/16.
 */
var dlq = [], downloading = [], http = require('http'), https = require('https'), fs = require('fs');
// dlq == array with download objects
// downloading == array with uri's downloading
/**
 * Actually downloads the file
 * @param dir   where to download
 * @param dFile    file name
 * @param dUrl    url to download from
 * @param callback   function to call when finished or if there is an error
 */
function downloadFile(dir, dFile, dUrl, callback) {
    var ttlBytes = 0, fileStream = fs.createWriteStream(dir + dFile.split('.')[1]);
    // sets the protocol to https or http
    var prot = (dUrl.split(':')[0] == 'https') ? https : http;
    // start downloading the file
    prot.get(dUrl, function (res) {
        res.on('data', function (d) {
            // keep track of how many bytes we are downloading
            ttlBytes += d.length;
            fileStream.write(d);
        });
        res.on('end', function () {
            // finished downloading, create response for callback
            var response = {
                file: dFile,
                bytes: ttlBytes,
                uri: dUrl
            };
            // remove the uri from the downloading array
            downloading.splice(downloading.indexOf(dUrl), 1);
            // callback with no error and some info on what was downloaded
            callback(false, response);
            // make sure to close the filestream
            fileStream.end();
        });
    }).on('error', function (e) {
        // error downloading, create a response object for callback
        var response = {
            file: dFile,
            bytes: ttlBytes,
            uri: dUrl,
            error: e
        };
        // clalback with err == true and info on what failed
        callback(true, response);
    });
}
/**
 * functions we want to export
 * add: adds the item to the download queue
 * process: goes through the queue and downloads items up to the specified limit
 * getCurrentDownloads: returns downloads array
 * getCurrentQueue: returns dql array
 */
module.exports = {
    add: function(dir, file, dluri) {
        var item = {
            dir: dir,       // dir to download to
            dluri: dluri,   // download uri
            file: file      // file name
        };
        dlq.push(item);      // add the object to the queue
    },
    process: function(limit, callback) {
        // if we are downloading less than the specified limit, and there are items in the queue...
        if (downloading.length <= limit && dlq.length > 0) {
            var offset = limit - downloading.length;   // how many items can we add to get to the limit?
            if (offset > 0) {
                offset = offset > dlq.length ?  dlq.length : offset;   // make sure we don't try to loop past the end of the q
                for (var x = 0; x < offset; x++) {
                    var next = dlq.shift();              // grabs the next download item from the queue
                    downloading.push(next.dluri);        // adds it to the downloading array
                    downloadFile(next.dir, next.file, next.dluri, callback);  // starts downloading the file
                }
            }
        }
    },
    getCurrentDownloads: function(callback) {
        callback(downloading);   // sends back the uri's currently downloading
    },
    getCurrentQueue: function(callback) {
        callback(dlq);     // sends back the queue
    }
};