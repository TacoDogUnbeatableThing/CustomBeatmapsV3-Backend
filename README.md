
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
