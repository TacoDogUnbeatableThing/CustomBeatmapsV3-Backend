import { Database } from 'sqlite3'
import { existsSync, mkdirSync } from 'fs';
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
                    console.log("GOT BEATMAP: ", result)
                    getBeatmap(parseBeatmapString(result))
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
        const resultingPackage : IBeatmapPackage = {
            filePath: filename.startsWith("db") ? filename.substr(3) : filename,
            time: new Date(),
            beatmaps: []
        }
        download(url, dirname(filename), {filename: basename(filename)}).then(async () => {
            console.log("DOWNLOADED", filename)
            const zip = await new StreamZip.async({ file: filename })
            const entries = Object.values(await zip.entries())
            for (let i = 0; i < entries.length; ++i) {
                const entry = entries[i]
                if (!entry.isDirectory) {
                    await parseZipEntry(zip, entry.name, beatmap => resultingPackage.beatmaps.push(beatmap))
                }
            }
            console.log("Finished going through entries")
            // Close zip file reading
            await zip.close();
            // Update database
            const currentPackages : IBeatmapPackage[] | undefined = <IBeatmapPackage[]>packages.get('packages')
            if (!!currentPackages)
                packages.set('packages', [...currentPackages, resultingPackage ])
            // Clear whatever submission we may have had before
            deleteSubmission(url)
            resolve()
        })
    })
}

export const stopDatabase = () => {
    packages.sync()
}
