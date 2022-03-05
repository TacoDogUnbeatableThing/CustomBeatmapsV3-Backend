import { Database } from 'sqlite3'
import { existsSync, mkdirSync } from 'fs';
import * as fs from 'fs'
import { basename, dirname } from 'path'
import JSONdb = require('simple-json-db')
import download = require('download')
import StreamZip = require('node-stream-zip')

import { IBeatmapSubmission } from './data'

// Setup our folder structure
if (!existsSync('db'))
    mkdirSync('db');
if (!existsSync('db/packages'))
    mkdirSync('db/packages');

const packages = new JSONdb('./db/packages.json');
const submissions = new JSONdb('./db/submissions.json');
if (!packages.has('packages'))
    packages.set('packages', [])

export const startDatabase = () => {
    // Empty for now
}

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
    submissions.set(submission.downloadURL, submission)
}
export const deleteSubmission = (downloadURL: string) => {
    submissions.delete(downloadURL)
}

const registerZipPackage = async (zipFilePath : string) => {

    const fileStats = await fs.promises.stat(zipFilePath)

    const resultingPackage : IBeatmapPackage = {
        filePath: zipFilePath.startsWith("db") ? zipFilePath.substr(3) : zipFilePath,
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
    // Clear packages
    packages.JSON({})
    const files = await fs.promises.readdir('db/packages');
    for (const file of files) {
        const filename = 'db/packages/' + file
        console.log("REFRESHING: ", filename)
        await registerZipPackage(filename)
    }
}

export const downloadBeatmapPackage = (url : string) : Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        // 1) Download zip file to db/packages
        let filename = 'db/packages/' + basename(new URL(url).pathname)
        console.log("FILENAME: ", filename)
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
            console.log("DOWNLOADED", filename)
            // We have a new zip file, register it.
            await registerZipPackage(filename)
            // Clear whatever submission we may have had before
            deleteSubmission(url)
            resolve()
        })
    })
}

export const stopDatabase = () => {
    packages.sync()
}
