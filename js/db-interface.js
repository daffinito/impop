/**
 * Created by daffinito on 12/24/15.
 */
var db = require('nano')('http://localhost:5984/imview');

module.exports = {
    updateDb: function (whichDb, tmpDb, callback) {
        // get the db _rev before updating to avoid errors.
        db.get(whichDb, function (error, existingDb) {
            if (!error) {
                // set the rev to avoid errors
                tmpDb._rev = existingDb._rev;
                // now that the rev is set correctly, we can insert the data into the db
                db.insert(tmpDb, whichDb, function (err, res) {
                    err ? callback(true, res) : callback(false);
                });
            } else callback(true, existingDb);
        });
    },

    getDb: function (whichDb, callback) {
        db.get(whichDb, {revs_info: false}, function (err, body) {
            err ? callback(true, body) : callback(false, body);  // gets the requested db or returns an error
        });
    }
};