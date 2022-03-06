import { Database } from 'sqlite3'
import { existsSync, mkdirSync } from 'fs';
import * as fs from 'fs'
import { basename, dirname } from 'path'
import { get, set } from 'lodash'

import JSONdb = require('simple-json-db')
import download = require('download')
import StreamZip = require('node-stream-zip')


import { IBeatmapSubmission, IUserInfo } from './data'

// Setup our folder structure
if (!existsSync('db'))
    mkdirSync('db');
if (!existsSync('db/public'))
    mkdirSync('db/public');
if (!existsSync('db/public/packages'))
    mkdirSync('db/public/packages');
if (!existsSync('db/private'))
    mkdirSync('db/private');

const packages = new JSONdb('./db/public/packages.json');
const submissions = new JSONdb('./db/public/submissions.json');
const users = new JSONdb('./db/private/users.json')
const highscores = new JSONdb('./db/public/highscores.json')

if (!packages.has('packages'))
    packages.set('packages', [])

interface IBeatmap {
    name : string,
    artist : string,
    creator: string,
    difficulty: string
}
interface IBeatmapPackage {
    filePath: string,
    time: Date,
    beatmaps: IBeatmap[]
}
interface IBeatmapHighScore {
    score: number
    accuracy: number
    fc: boolean
}

const getBeatmapProp = (osu : string, label : string) => {
    const match = osu.match(`${label}: *(.+?)\r?\n`);
    if (!!match && match.length >= 1)
        return match[1]
    return ""
}

const parseBeatmapString = (osu : string) : IBeatmap => {
    return {
        name: getBeatmapProp(osu, "TitleUnicode"),
        artist: getBeatmapProp(osu, "Artist"),
        creator: getBeatmapProp(osu, "Creator"),
        difficulty: getBeatmapProp(osu, "Version")
    }
}

const parseZipEntry = (zip: any, entryPath : string, getBeatmap: (beatmap: IBeatmap) => void) => {
    return new Promise<void>(resolve => {
        if (entryPath.endsWith('.osu')) {
            zip.stream(entryPath).then((stm : any) => {
                console.log("STREAMING", entryPath)
                let result = ''
                stm.on('data', (chunk : string) => {
                    result += chunk
                })
                stm.on('end', () => {
                    const newBeatmap = parseBeatmapString(result);
                    console.log("GOT: ", newBeatmap)
                    getBeatmap(newBeatmap)
                    resolve()
                });
            })
        } else {
            resolve()
        }
    })
}

// We also keep track of submissions so we can easily test them from the game.
export const registerSubmission = (submission : IBeatmapSubmission) => {
    console.log("NEW SUBMISSION: ", submission)
    submissions.set(submission.downloadURL, submission)
}
export const deleteSubmission = (downloadURL: string) => {
    console.log("DELETE SUBMISSION: ", downloadURL)
    submissions.delete(downloadURL)
}

const registerZipPackage = async (zipFilePath : string) => {

    const fileStats = await fs.promises.stat(zipFilePath)

    const resultingPackage : IBeatmapPackage = {
        filePath: zipFilePath.startsWith("db/public/") ? zipFilePath.substr(10) : zipFilePath,
        time: fileStats.birthtime,
        beatmaps: []
    }

    const zip = await new StreamZip.async({ file: zipFilePath })
    const entries = Object.values(await zip.entries())
    for (const entry of entries) {
        if (!entry.isDirectory) {
            await parseZipEntry(zip, entry.name, beatmap => resultingPackage.beatmaps.push(beatmap))
        }
    }
    // Close zip file reading
    await zip.close();
    // Update database
    let currentPackages : IBeatmapPackage[] | undefined = <IBeatmapPackage[]>packages.get('packages')
    packages.set('packages', !!currentPackages? [...currentPackages, resultingPackage ] : [resultingPackage])
}

// Will reload `packages.json` based on the beatmap files in `packages`
export const refreshDatabase = async () => {
    console.log("REFRESHING DATABASE")
    // Clear packages
    packages.JSON({})
    const files = await fs.promises.readdir('db/public/packages');
    for (const file of files) {
        const filename = 'db/public/packages/' + file
        console.log("   ", filename)
        await registerZipPackage(filename)
    }
}

export const downloadBeatmapPackage = (url : string) : Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        // 1) Download zip file to db/packages
        let filename = 'db/public/packages/' + basename(new URL(url).pathname)
        console.log("DOWNLOADING PACKAGE: ", url, " => ", filename)
        // Make unique in the event that there are duplicates
        if (existsSync(filename)) {
            let ver = 1 // start at ver2
            let checkname
            do {
                ver += 1
                checkname = filename + "_ver" + ver
            } while (existsSync(checkname))
            filename = checkname
        }
        download(url, dirname(filename), {filename: basename(filename)}).then(async () => {
            console.log("        downloaded: ", filename)
            // We have a new zip file, register it.
            await registerZipPackage(filename)
            // Clear whatever submission we may have had before
            deleteSubmission(url)
            resolve()
        })
    })
}

// Credits to https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
const cyrb53 = function(str : string, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
};

const generateUniqueUserId = (username : string) : string => {
    let hash : string = cyrb53(username).toString()
    while (users.has(hash)) {
        hash = cyrb53(hash).toString()
    }
    return hash
}

export const registerNewUser = (username : string) : Promise<string> => {
    return new Promise((resolve, reject) => {

        // Usernames must be unique
        if (!!Object.values(users.JSON).find(userData => userData.name.toLowerCase() === username.toLowerCase())) {
            reject("Username already taken!");
            return;
        }

        const newUniqueId = generateUniqueUserId(username)
        const newUserData : IUserInfo = {name: username}
        console.log("NEW USER: ", username, " => ", newUserData)
        users.set(newUniqueId, newUserData)
        resolve(newUniqueId)
    })
}

export const getUserInfo = (uniqueUserId : string) : Promise<IUserInfo> => {
    return new Promise((resolve, reject) => {
        if (users.has(uniqueUserId)) {
            const result = users.get(uniqueUserId) as IUserInfo
            resolve(result)
        } else {
            reject("No user with given id found.")
        }
    })
}

// Manually set our high score
const setScore = (packageFilePath: string, beatmapIndex : number, username : string, score : IBeatmapHighScore) : Promise<void> => {
    return new Promise((resolve, reject) => {
        const toSet : any = highscores.get(packageFilePath) ?? {}
        set(toSet, [beatmapIndex.toString(), username], score)
        highscores.set(packageFilePath, toSet)
        resolve()
    })
}

const registerScoreUsername = (packageFilePath: string, beatmapIndex : number, username : string, score : IBeatmapHighScore) : Promise<boolean> => {
    return new Promise((resolve, reject) => {
        console.log(`SCORE for ${username} on ${packageFilePath}[${beatmapIndex}]:`, score)
        const prevRecord : IBeatmapHighScore = get(highscores.get(packageFilePath), [beatmapIndex.toString(), username])
        console.log("    (prev record: ", prevRecord, ")")
        if (!!prevRecord && !!prevRecord.score) {
            // Check for high score
            // might abstract this one out to a comparison or something...
            if (score.score > prevRecord.score) {
                return setScore(packageFilePath, beatmapIndex, username, score).then(() => resolve(true))
            } else {
                resolve(false)
            }
        } else {
            console.log("    new: ", score.score)
            return setScore(packageFilePath, beatmapIndex, username, score).then(() => resolve(true))
        }
    })
}

/**
 * Registers a user score
 * 
 * @param packageFilePath The package filepath (ex. packages/...zip)
 * @param beatmapIndex The integer index within the package of WHICH beatmap was played
 * @param uniqueUserId The unique/private id of a user
 * @param score
 * @returns A Promise of whether or not the user got a new high score
 */
export const registerScoreUserId = (packageFilePath: string, beatmapIndex : number, uniqueUserId : string, score : IBeatmapHighScore) : Promise<boolean> => {
    return getUserInfo(uniqueUserId).then(userInfo => registerScoreUsername(packageFilePath, beatmapIndex, userInfo.name, score))
}
