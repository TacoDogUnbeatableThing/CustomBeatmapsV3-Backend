import { runClient } from "./client";
import { readFileSync } from "fs";
import { downloadBeatmapPackage, registerSubmission, deleteSubmission, getUserInfo, registerNewUser, registerScoreUserId } from "./db";

import { exec } from 'child_process'
import { runUserServer } from "./user-server";

const config = JSON.parse(readFileSync('config.json', 'utf8'))

// File Server for db/public
console.log(`Hosting db/public on port ${config["public-data-server-port"]}`)
exec(`http-server db/public --port ${config["public-data-server-port"]}`);

// Discord client
runClient({
    onAcceptBeatmap : (beatmapURL, onComplete) => {
        downloadBeatmapPackage(beatmapURL).then(() => onComplete())
    },
    onPostSubmission : registerSubmission,
    onRejectSubmission : deleteSubmission,
    config
}).then(() => {
    // Node server
    return runUserServer({
        getUserInfoFromUniqueId: getUserInfo,
        createNewUser: registerNewUser,
        postHighScore : submission => registerScoreUserId(submission.serverPackageURL, submission.beatmapIndex, submission.uniqueUserId, {score: submission.score, accuracy: submission.accuracy, fc: submission.fc}),
        config: config
    })
})
