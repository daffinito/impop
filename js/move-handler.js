/**
 * Created by daffinito on 1/9/16.
 */
var fs = require('fs');

module.exports = {
    moveFile: function (oldPath, newPath, callback) {
        var errors = {
            num: 0,
            text: ''
        };
        fs.unlink(newPath, function (err) {
            if (err) {
                errors.num++;
                errors.text = "Error deleting newfile: " + newPath;
                if (callback)  callback(true, errors);
            }
            else {
                fs.rename(oldPath, newPath, function (err) {
                    if (err) {
                        errors.num++;
                        errors.text = "Error renaming " + oldPath + " to " + newPath;
                        if (callback) callback(true, errors);
                    }
                    else if (callback) callback(false, "Renamed " + oldPath + " to " + newPath);
                });
            }
        });
    }
};