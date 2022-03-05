import { runClient } from "./client";
import { startDatabase, stopDatabase, downloadBeatmapPackage, registerSubmission, deleteSubmission } from "./db";

import { exec } from 'child_process'


// Expose 'db' so we can access it from our mod
exec('http-server db');

startDatabase()
//downloadBeatmapPackage("https://cdn.discordapp.com/attachments/949052886611005481/949421620068499476/LOCAL_PULL_UP.zip")
runClient({
    onAcceptBeatmap : (beatmapURL, onComplete) => {
        downloadBeatmapPackage(beatmapURL).then(() => onComplete())
    },
    onPostSubmission : registerSubmission,
    onRejectSubmission : deleteSubmission
});
stopDatabase()

/*
addBeatmap({
    name: "Chainsaw Funk",
    artist: "2 Mello",
    creator: "slightlyshort",
    difficulty: "Massacre",
    filePath: "LOCAL_Chainsaw Funk.zip"
});
*/


/*
getAllBeatmaps().then(data => {
    console.log(data);
}).finally(() => {
    closeAll();
});
*/

/*

TODO/PLANS:

- Discord bot that can read messages


- Discord bot with a standard means of posting a beatmap package
- Link gets referenced to a verifier only channel, at least 1 verifier must give it a thumbs up or reply.
- Once it's verified, delete the reference in the verifier only channel and UPLOAD to the server in a folder somewhere

- Have some kind of database hosted (for now literally just use a json file LMAO)

*/
