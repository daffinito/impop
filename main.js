/**
 * Created by daffinito on 12/24/15.
 */
/**
 *  requires
 */
var db = require('./js/db-interface'), imgur = require('./js/imgur-processor'), gfycat = require('./js/gfycat-processor'),
    https = require('https'), http = require('http'), fs = require('fs'), logger = require('log4node'),
    args = require('minimist')(process.argv.slice(2)), mover = require('./js/move-handler'),
    arghandler = require('./js/arg-handler'), downloadq = require('./js/dl-queue');
/**
 *  Global Vars
 */
var dir = '', imgsDb, oldimgsDb, catsDb, metaDb = {}, catnum = 0, catname, imgurCID, ttlErrs = 0, errors = [],
    forceDownload = false, currentlyMoving = true, movingCount = 0, ttlMv = 0, downloadlimit,
    alreadyDeleted = [], processingCount = 0, currentlyProcessing = [], ttlBytes = 0, ttlDl = 0;
/**
 * Displays command usage
 * @param message
 */
function usage(message) {
    if (message) {
        console.error('ERROR: %s', message);
    }
    console.error("");
    console.error('Usage: %s %s [-f/--force] [-n/--nolog] [-b/--debug] [-l/--limit dl-limit] [-i/--items items] -d/--domain domain ' +
        '-c/--category category -p/--path path', process.argv[0], process.argv[1]);
    console.error('-f is optional. It forces the download and update.');
    console.error('-n/--nolog is optional. It redirects the log to go to the console.');
    console.error('-b/--debug is optional. It enables debug logging.');
    console.error('-l/--limit default is 10 if not specified');
    console.error('-i/--items how many items to download from reddit. Default = 25, max = 100');
    process.exit(2);
}
/**
 * First function called to start the initialization process
 */
function init() {
    // get the date for log naming purposes
    var date = new Date();
    // check to see if -n or --nolog was parsed. if so, logging goes to console
    // setupLogging() with no variables == log to console
    (!args.n || args.nolog) ? setupLogging('logs/log-' + date.getTime() + '.log') : setupLogging();
    logger.info("Starting Up.");
    imgur.getImgurCID(setImgurCID);    // gets the imgur client id
    db.getDb('cats', setCatsDoc);     // gets the category db
}
/**
 * The rest of the startup stuff, only called after the category db has been loaded
 */
function startUp() {
    db.getDb('imgs', setImgsDoc);
    db.getDb('metadata', setMDDoc);
    arghandler.checkArgs(args, catsDb, finishArgs);
}
/**
 * handles the response from getting the imgur cid
 * @param err   == true if unable to gather imgur cid
 * @param body  == the error or the imgur cid
 */
function setImgurCID(err, body) {
    if (!err) imgurCID = body;
    else logger.error("Error loading imgur client id: " + body);
}
/**
 * sets up the catsDb variable
 * @param err   == true if an error was encountered
 * @param body  == the error or the category db variable
 */
function setCatsDoc(err, body) {
    if (!err) {
        logger.debug("Cats Db loaded.");
        catsDb = body;
        // now that the category db is loaded, we can finish starting up
        startUp();
    } else {
        logger.error("Error getting cats DB: " + body);
        ttlErrs++;
        errors.push("Error getting cats DB: " + body);
    }
}
/**
 * sets up the imgs db variable
 * @param err   == true if an error was encountered
 * @param body  == the error or the images db variable
 */
function setImgsDoc(err, body) {
    if (!err) {
        logger.debug("Imgs Db loaded.");
        // oldimgsDb is used during move operations. We need to have a static version for comparison
        oldimgsDb = body;
        imgsDb = body;
    } else {
        logger.error("Error getting imgs Db: " + body);
        ttlErrs++;
        errors.push("Error getting imgs DB: " + body);
    }
}
/**
 * sets up the Metadata db variable
 * @param err   == true if an error was encountered
 * @param body  == the error or the metabase db variable
 */
function setMDDoc(err, body) {
    if (!err) {
        logger.debug("Meta Db loaded.");
        metaDb = body;
    } else {
        logger.error("Error getting meta db" + body);
        ttlErrs++;
        errors.push("Error getting meta DB: " + body);
    }
}
/**
 * Finishes the argument setup
 * @param err  == true if there was an error or missing parameter
 * @param body  == the settings / error
 * @param newcatsDb == if a new category was created, we need to update the catsDb var with this new one
 */
function finishArgs(err, body, newcatsDb) {
    if (!err) {
        // setup the global variables based on arguments
        catname = body.catname;
        catnum = body.catnum;
        forceDownload = body.forceDownload;
        downloadlimit = body.downloadlimit;
        dir = body.dir;
        // sends the req for json to reddit
        createReq(body.reddituri);
        logger.info("Category name: " + body.catname);
        logger.info("Category number: " + body.catnum);
        logger.info("Force Download: " + body.forceDownload);
        logger.info("Directory: " + body.dir);
        if (body.updateCatsDb) {
            catsDb = newcatsDb;
            logger.debug("Updating the cats db");
            db.updateDb('cats', catsDb, updateCatDb);
        }
    } else {
        // if there was an error with the arguments...
        if (body.missingArgs.length > 0) {
            // if there were missing arguments, list them
            for (var x = 0; x < body.missingArgs.length; x++)
                console.error("Missing Args: " + body.missingArgs[x]);
            // show usage and exit
            usage();
        } else usage(body.errortext); // something went wrong (but it wasn't missing arguments). show usage and error text
    }
}
/**
 * handles the callback when the catsDb is updated
 * @param err == true if there was an error updating the db
 * @param res == the error message
 */
function updateCatDb(err, res) {
    if (err) {
        logger.error("Error updating category db.");
        logger.error(res);
        ttlErrs++;
        errors.push("Error updating category db: " + res);
    } else logger.info("Updated category DB successfully.");
}
/**
 * Sets up the logging or redirects it to console.
 * logs go in ./logs/ by default and are named log-[ctime].log
 * @param logfile
 */
function setupLogging(logfile) {
    // by default, log level is info
    // if -b or --debug, set it to debug
    var loglevel = (args.b || args.debug) ? 'debug' : 'info';
    if (logfile) {
        // try to create the directory
        try {
            fs.mkdirSync('logs');
            logger.debug("Created logs directory.");
        } catch (e) {
            // if there is any error EXCEPT already exists
            if (e.code != 'EEXIST') {
                logger.error("Error creating logs directory: " + e);
                ttlErrs++;
                errors.push("Error creating logs directory: " + e);
            }
            else logger.debug("Logs directory already exists."); // if the directory already exists simply log it
        }
        // set up logger to use the level and file
        logger.reconfigure({level: loglevel, file: logfile});
    } else logger.reconfigure({level: loglevel}); // set up logger to use the level and output to console
}
function parseContent(c) {
    var offset = 1, content;
    try {
        content = JSON.parse(c);
    } catch (e) {
        logger.error("Failed to parse JSON");
        logger.error(c);
        logger.error("Error: ");
        logger.error(e);
        ttlErrs++;
        errors.push("Failed to parse JSON");
    }
    for (var i = 0; i < content.data.children.length; i++) {
        logger.debug("Parsing content, reviewing post " + i);
        if (content.data.children[i].data.thumbnail == "self" || /reddit[.]com/i.test(content.data.children[i].data.url)) {
            offset--;
            logger.debug("Post contains no images, changing offset. New offset: " + offset);
        } else {
            updateMetaData(i + offset,
                content.data.children[i].data.url,
                content.data.children[i].data.permalink,
                content.data.children[i].data.title,
                content.data.children[i].data.score,
                'img');
            checkExists(i + offset, content.data.children[i].data.url);
        }
    }
    if (movingCount == 0) {
        currentlyMoving = false;
        downloadq.process(downloadlimit,downloadHandler);
    }
}
/**
 * handles the downloads. this function is what we pass to the downloadq.process
 * this is called when a download finishes or has an error
 * @param err
 * @param body
 */
function downloadHandler(err, body) {
    // first check to see how may are in the dl queue
    downloadq.getCurrentQueue(function (qlist) {
        if (qlist.length > 0) {
            logger.debug("There are still " + qlist.length + " files in queue.");
            // if there are still items in the dl q, keep processing
            downloadq.process(downloadlimit,downloadHandler);
        }
    });
    if (!err) {
        ttlBytes += body.bytes;
        ttlDl++;
        downloadq.getCurrentDownloads(function (downloadList) {
            logger.debug("There are still " + downloadList.length + " files downloading.");
            if (currentlyProcessing.length > 0)
                logger.debug("There are still " + currentlyProcessing.length + " files processing.");
            if (downloadList.length == 0 && processingCount == 0)
                logger.debug("Downloading and processing has finished.");
        });
    } else {
        ttlErrs++;
        errors.push(body.error);
        logger.error("Error downloading " + body.file + ": " + body.uri);
        logger.error(body.error);
    }
}
/**
 * checks if the image/video already exists.
 * @param cFile like '1'
 * @param cUrl like 'imgur.com/asdfs3
 */
function checkExists(cFile, cUrl) {
    var okToDl = true;
    logger.debug("Checking if " + cFile + " already exists.");
    if (!forceDownload) {
        for (var oldcatDotImg in oldimgsDb) if (oldimgsDb.hasOwnProperty(oldcatDotImg)) {
            if (okToDl) {
                if (oldcatDotImg.split('.')[0] == catnum) {
                    if (oldimgsDb[oldcatDotImg] == cUrl) {
                        if (oldcatDotImg.split('.')[1] == cFile) {
                            logger.debug(cUrl + " -- Already exists in same location!");
                            okToDl = false;
                        } else if (!alreadyDeleted[cFile]) {
                            logger.debug(cUrl + " -- Already exists in but in a new location!");
                            movingCount++;
                            okToDl = false;
                            updateDoc(cFile, cUrl);
                            alreadyDeleted[oldcatDotImg.split('.')[1]] = cUrl;
                            alreadyDeleted[cFile] = cUrl;
                            logger.debug('Moving %s to %s', oldcatDotImg.split('.')[1], cFile);
                            mover.moveFile(dir + oldcatDotImg.split('.')[1], dir + cFile, function (err, body) {
                                ttlMv++;
                                if (!err) {
                                    logger.info(body);
                                    movingCount--;
                                    if (movingCount == 0) {
                                        currentlyMoving = false;
                                    }
                                } else {
                                    logger.error(body.text);
                                    ttlErrs += body.num
                                }
                            });
                        } else {
                            logger.debug("Already exists but source has been deleted! Re-downloading!");
                            okToDl = true;
                        }
                    } else okToDl = true;
                }
            }
        }
    }
    if (okToDl) {
        logger.debug(cUrl + " -- Doesn't exist, getting download URL.");
        getDownloadUrl(cFile, cUrl);
    }
}
function processImgur(file, uri) {
    processingCount++;
    currentlyProcessing.push(uri);
    logger.debug("Processing Imgur link: " + uri);
    imgur.process(file, uri, imgurCID, function (err, res) {
        if (!err) {
            logger.debug("Finished processing imgur: " + uri);
            ttlBytes += res.bytes;
            downloadq.add(dir, catnum + "." + res.file, res.dluri);
            downloadq.process(downloadlimit, downloadHandler);
            updateDoc(res.file, res.uri);
            metaDb[res.uri].type = res.type;
        } else {
            logger.error("Error processing Imgur: " + uri);
            logger.error(res);
            ttlErrs++;
            errors.push("Error processing Imgur: " + uri);
        }
        processingCount--;
        currentlyProcessing.splice(currentlyProcessing.indexOf(uri), 1);
    });
}
function processGfycat(file, uri) {
    processingCount++;
    currentlyProcessing.push(uri);
    logger.debug("Processing Gfycat link: " + uri);
    gfycat.process(file, uri, function (err, res) {
        if (!err) {
            logger.debug("Finished processing Gfycat: " + uri);
            ttlBytes += res.bytes;
            downloadq.add(dir, catnum + "." + res.file, res.dluri);
            downloadq.process(downloadlimit, downloadHandler);
            updateDoc(res.file, res.uri);
            metaDb[res.uri].type = res.type;
        } else {
            logger.error("Error processing Gfycat: " + uri);
            logger.error(res);
            ttlErrs++;
            errors.push("Error processing Gfycat: " + uri);
        }
        processingCount--;
        currentlyProcessing.splice(currentlyProcessing.indexOf(uri), 1);
    });
}
function processDefault(file, uri) {
    downloadq.add(dir, catnum + "." + file, uri);
    downloadq.process(downloadlimit, downloadHandler);
    updateDoc(file, uri);
    metaDb[uri].type = 'img';
}
function getDownloadUrl(file, uri) {
    var domain = uri.split('/')[2];
    if (/imgur[.]com/i.test(domain)) processImgur(file, uri);
    else if (/gfycat[.]com/i.test(domain)) processGfycat(file, uri);
    else processDefault(file, uri);
}
/**
 * updates the imgDb variable
 * @param file == without the category
 * @param uri  == reddit uri of the image
 */
function updateDoc(file, uri) {
    var catImg = catnum + '.' + file;
    imgsDb[catImg] = uri;
}
/**
 * updates the metadata variable
 * @param filenum   == just the file num, not the cat.filenum
 * @param imageuri  == image uri
 * @param reddituri == reddit uri
 * @param title     == title of post
 * @param score     == reddit score
 * @param type     == img mp4 or webm
 */
function updateMetaData(filenum, imageuri, reddituri, title, score, type) {
    metaDb[imageuri] = {
        'catdotimg': catnum + "." + filenum,
        'thetitle': title,
        'score': score,
        'reddituri': reddituri,
        'uri': imageuri,
        'catname': catname,
        'type': type
    };
}
/**
 * downloads the reddit json
 * @param uri == reddit url ie https://www.reddit.com/r/pics/.json?limit=100
 */
function createReq(uri) {
    var getData = '';
    https.get(uri, function (res) {
        res.on('data', function (d) {
            ttlBytes += d.length;
            getData += d;
        });
        res.on('end', function () {
            parseContent(getData);
        });
    }).on('error', function (e) {
        logger.error(e);
        ttlErrs++;
        errors.push("Error downloading Reddit JSON." + e);
    });
}
/**
 * handles the process exit
 * @param options
 * @param err
 */
function exitHandler(options, err) {
    if (options.cleanup) {
        logger.info("Updating imgs db.");
        db.updateDb('imgs', imgsDb, function (err, res) {
            if (err) {
                logger.error("Error updating imgs db.");
                logger.error(res);
                ttlErrs++;
                errors.push("Error updating imgs db.");
            } else logger.info("Updated imgs DB successfully.");
            logger.info("Updating metadata db.");
            db.updateDb('metadata', metaDb, function (err, res) {
                if (err) {
                    logger.error("Error updating metadata db.");
                    logger.error(res);
                    ttlErrs++;
                    errors.push("Error updating metadata db.");
                } else logger.info("Updated metadata DB successfully.");
                logger.info("Stats: Downloaded: " + ttlDl + " | Moved: " + ttlMv
                    + " | KB: " + Number(ttlBytes / 1024).toFixed(2) + " kb | Errs: "
                    + ttlErrs);
                if (ttlErrs > 0) {
                    for (var x = 0; x < ttlErrs; x++)
                        logger.info("Error #" + x + 1 + ": " + errors[x]);
                }
                logger.info("Shutting down.");
                process.exit();
            });
        });
    }
    if (err) logger.debug(err.stack);
    if (options.exit) {
        logger.error(">>> You hit control-C <<<");
        process.exit();
    }
}
init();   // starts the app
process.on('beforeExit', exitHandler.bind(null, {cleanup: true}));    // ensures dbs get updated before exiting
process.on('SIGINT', exitHandler.bind(null, {exit: true}));      //catches ctrl+c
process.on('uncaughtException', exitHandler.bind(null, {exit: true}));   //catches uncaught exceptions