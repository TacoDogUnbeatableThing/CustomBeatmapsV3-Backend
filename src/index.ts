import { runClient } from "./client";
import { readFileSync } from "fs";
import { basename } from 'path';
import { exec } from 'child_process'

import { downloadBeatmapPackage, registerSubmission, deleteSubmission, getUserInfo, registerNewUser, registerScoreUserId } from "./db";
import { runUserServer } from "./user-server";
import { logger } from './publiclogger'

const config = JSON.parse(readFileSync('config.json', 'utf8'))

// File Server for db/public
/*logger.info(`Hosting db/public on port ${config["public-data-server-port"]}`)
exec(`http-server db/public --port ${config["public-data-server-port"]}`, (error, stdout, stderr) => {
    logger.info("(HTTP server response)")
    if (!!stdout)
        logger.info(stdout)
    if (!!error)
        logger.error(error)
    if (!!stderr)
        logger.error(stderr)
});
*/

// Discord client
runClient({
    onAcceptBeatmap : (attachmentName, beatmapURL, onComplete) => {
        let filename = basename(new URL(beatmapURL).pathname)
        deleteSubmission(attachmentName)
        downloadBeatmapPackage(beatmapURL, filename).then(() => onComplete())
    },
    onPostSubmission : registerSubmission,
    onRejectSubmission : deleteSubmission,
    config
}).then(() => {
    // Node server
    return runUserServer({
        getUserInfoFromUniqueId: getUserInfo,
        createNewUser: registerNewUser,
        postHighScore : submission => registerScoreUserId(submission.beatmapKey, submission.uniqueUserId, {score: submission.score, accuracy: submission.accuracy, fc: submission.fc}),
        config: config
    })
})
