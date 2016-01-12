/**
 * Created by daffinito on 1/9/16.
 */

var fs = require('fs');

module.exports = {
    checkArgs: function (args, catsDb, callback) {
        var counter = 0;
        // this is the response object we will return
        var resp = {
            catname: '',             // category name
            catnum: 0,               // category number, 0 by default because we will never use 0
            updateCatsDb: false,     // update the category db?
            dir: '',                 // download dir
            forceDownload: false,    // force download setting
            reddituri: '',           // the reddit uri we will be using
            errortext: '',           // error messages
            error: false,            // was there an error?
            missingArgs: [],         // any missing args
            downloadlimit: 10        // download limit, default 10
        };
        // sets the number of items to gather from reddit
        var items = args.i ? args.i : args.items ? args.items : 25;
        // sets forcedownload
        resp.forceDownload = (args.f || args.force) ? true : false;
        // check if the domain was supplied
        if (args.d || args.domain) {
            if (args.d == 'reddit' || args.domain == 'reddit') {
                resp.reddituri = "https://www.reddit.com/r/";
            } else {
                // wrong domain supplied
                resp.errortext = 'Only reddit is supported at this time.';
                resp.error = true;
            }
        } else {
            // no domain supplied, error out
            resp.missingArgs.push('-d');
        }
        // doublecheck to make sure we are only working with reddit
        if (/reddit/i.test(resp.reddituri)) {
            // if a category was given
            if (args.c || args.category) {
                // sets the category name in the response
                resp.catname = args.c || args.category;
                // check to see if the category already exists
                for (var cat in catsDb) if (catsDb.hasOwnProperty(cat)) {
                    // if it does, set the response catnum, otherwise leave it as 0
                    if (catsDb[cat].split('/').slice(-1) == resp.catname) resp.catnum = cat;
                    counter++;
                }
                // if catnum still == 0, it means it doesn't exist
                if (resp.catnum == 0) {
                    // you'd think it'd be + 1, but we have to account for the 2 default items in db (_rev and _id). +1 -2 = -1
                    resp.catnum = counter - 1;
                    // update the catsDb variable to update the db
                    catsDb[resp.catnum] = 'reddit.com/r/' + resp.catname;
                    // make sure we know to update the db
                    resp.updateCatsDb = true;
                }
                // finish setting the reddit uri
                resp.reddituri = resp.reddituri + resp.catname + "/.json?limit=" + items;
            } else {
                // didn't supply a category, error out
                resp.missingArgs.push('-c');
            }
        }
        else {
            // reddit wasn't found in the uri, so something went wrong.
            resp.error = true;
            resp.errortext = 'Something went wrong setting the domain';
        }
        // if path supplied, use that path, otherwise error with missing arg
        (args.p || args.path) ? resp.dir = args.p || args.path : resp.missingArgs.push('-p');

        // check for optional -l or --limit, set appropriately (or 10 default)
        resp.downloadlimit = args.l || args.limit ? args.l || args.limit : 10;

        // checks to see if there were any missing args
        if (resp.missingArgs.length > 0) {
            resp.error = true;
            resp.errortext = "Missing Args";
        }

        // sanitize directory
        resp.dir = resp.dir.slice(-1) == '/' ? resp.dir + resp.catnum + '/' : resp.dir = resp.dir + '/' + resp.catnum + '/';

        // create the directory
        // using sync since it's a fast operation and we need to ensure it is created before continuing
        try {
            fs.mkdirSync(resp.dir);
        }
        catch (e) {
            if (e.code != 'EEXIST') {
                // something went wrong
                resp.error = true;
                resp.errortext = "Error creating directory: " + e;
            }
            else {
                // directory already exists, no need to log or do anything
            }
        }
        // done going through args, send back the resp object
        callback(resp.error,resp, catsDb);
    }
};