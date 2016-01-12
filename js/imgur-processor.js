/**
 * Created by daffinito on 12/24/15.
 */
var https = require('https'), fs = require('fs');

function getImgurJson(options, gal, id, file, uri, bytes, attemptNum, reattempt, callback) {
    var json = '';
    var resp = {
        'file': file,
        'uri': uri,
        'type': '',
        'bytes': bytes,
        'dluri': ''
    };
    var req = https.request(options, function (res) {
        res.on('data', function (d) {
            bytes += d.length;
            json += d;
        });
        res.on('end', function () {
            try {
                var resjson = JSON.parse(json);
            }
            catch (e) {
                callback(true, "Error parsing imgur JSON for uri: " + uri + " json: " + json);
            }
            if (resjson.success) {
                if (resjson.data.webm) {
                    resp.type ='webm';
                    resp.dluri = resjson.data.webm;
                    callback(false, resp);
                }
                else if (resjson.data.mp4) {
                    resp.type = 'mp4';
                    resp.dluri = resjson.data.mp4;
                    callback(false, resp);
                }
                else if (resjson.data.link) {
                    resp.type = 'img';
                    resp.dluri = resjson.data.link;
                    callback(false, resp);
                }
                else if (resjson.data[0].link) {
                    resp.type = 'img';
                    resp.dluri = resjson.data[0].link;
                    callback(false, resp);
                } else callback(true, 'Unable to locate download link. File: ' + file + ' uri: ' + uri);
            } else if (gal && reattempt && attemptNum == 1) {
                options.path = '/3/album/' + id + '/images';
                getImgurJson(options, gal, id, file, uri, bytes, 2, true, callback);
            } else if (gal && reattempt && attemptNum == 2) {
                options.path = '/3/image/' + id;
                getImgurJson(options, gal, id, file, uri, bytes, 3, false, callback);
            } else {
                    callback(true, resjson);
            }
        });
    }).on('error', function (e) {
        callback(true, "Imgur processing error for uri: " + uri + " e:" + e);
    });
    req.end();
}
module.exports = {
    getImgurCID: function (callback) {
        try {
            // try loading imgur cid from env, if not there try imgurclientid.txt
            var imgurClientId = process.env.IMGURCID || fs.readFileSync('imgurclientid.txt', 'utf8');
            if (callback) {
                callback(false, imgurClientId);
            }
        }
        catch (err) {
            if (callback) {
                callback(true, err);
            }
        }
    },
    process: function (file, uri, imgurClientId, callback) {
        var imgurReqHdr = {'Authorization': 'Client-ID ' + imgurClientId};
        var regexalb = /[/]a[/]/i;
        var regexgal = /[/]gallery[/]/i;
        var regexgalhelper = /[?]/i;
        var regexhelper = /[.]/;
        var id = '', options, gal = false;
        if (!regexalb.test(uri) && !regexgal.test(uri)) {
            id = uri.split('/').slice(-1);
            if (regexhelper.test(id)) {
                var t = id.toString().split('.');
                id = t[0];
            }
            options = {
                hostname: 'api.imgur.com',
                port: 443,
                path: '/3/image/' + id,
                method: 'GET',
                headers: imgurReqHdr
            };
        }
        else {
            if (regexalb.test(uri)) {
                id = uri.split('/').slice(-1);
                options = {
                    hostname: 'api.imgur.com',
                    port: 443,
                    path: '/3/album/' + id + '/images',
                    method: 'GET',
                    headers: imgurReqHdr
                };
            }
            if (regexgal.test(uri)) {
                gal = true;
                var findId = uri.split('/');
                for (var n = 0; n < findId.length; n++) {
                    if (findId[n] == 'gallery') {
                        id = findId[n + 1];
                        n = 9999;
                    }
                }
                if (regexgalhelper.test(id)) {
                    id = id.toString().split('?')[0];
                }
                options = {
                    hostname: 'api.imgur.com',
                    port: 443,
                    path: '/3/gallery/image/' + id,
                    method: 'GET',
                    headers: imgurReqHdr
                };
            }
        }
        getImgurJson(options, gal, id, file, uri, 0, 1, true, callback);
    }
};