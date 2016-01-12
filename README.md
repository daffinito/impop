# impop

This is a work in progress.

This app will download all images/videos from the given domain/category, then update the db. It is designed to work with my other project, imview.

```
node ./main.js [-f/--force] [-n/--nolog] [-b/--debug] [-l/--limit dl-limit] [-i/--items items] -d/--domain domain -c/--category category -p/--path path
-f is optional. It forces the download and update.
-n/--nolog is optional: It redirects the log to go to the console.
-b/--debug is optional: It enables debug logging.
-l/--limit is optional: download limit. default is 10 if not specified
-i/--items is optional: how many items to download from reddit. Default = 25, max = 100
```

create a file called imgurclientid.txt with your imgur client id in the root of the project
or use an environmental variable: IMGURCID
