
# SETUP
1) `clone <repo>`
2) `cd CustomBeatmapsv3-Backend`
3) `apt-get install nodejs`
4) `npm install http-server`
5) `mkdir db`
6) `echo <YOUR BOT TOKEN HERE> > bot-secret.txt`
7) Fill in `config.json` with the proper channel IDs
8) `npm start`

Now go to `localhost:8080` or wherever you've hosted it and you will have a file server that updates when a new beatmap is added.

To access the beatmaps database go to `localhost:8080/packages.json`

To access currently processing submissions,go to `localhost:8080/submissions.json` (may be empty)


# CustomBeatmapsv2 conversion

1) Go to the `#beatmaps-archive` channel on a browser
2) Run the following into the developer console (don't trust anyone who tells you to do this unless you analyze the code and know what it does)
```js
var downloads = document.getElementsByClassName('anchor-1MIwyf anchorUnderlineOnHover-2qPutX downloadWrapper-1Cy2Fi')
var result = ""
for (let i = 0; i < downloads.length; ++i) {
    result += downloads[i].href + "\n"
}
let blob = new Blob([result], {type: 'text/plain'});
URL.createObjectURL(blob)
```
3) Open the link generated in the console and copy the resulting contents into `legacy-archive.txt`
4) Run `npm run download-legacy`