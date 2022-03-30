import { readFileSync } from "fs";

import { downloadBeatmapPackage, packageDownloaded, changeDate } from "./db";

// Processes each line of a "legacy download list" file, to help us deal with this.
const downloadLegacyPackages = async (downloadsFilePath : string, processDownload : (download : string, time : Date | undefined) => void, updateDate : (url: string, time : Date) => void) => {
    const lines = readFileSync(downloadsFilePath, 'utf8').split('\n')
    for (const line of lines) {
        if (!line.startsWith('#')) {
            const parts = line.split(',')
            const packageURL = parts[0]
            const datePart = parts[1]
            const date = !!datePart? new Date(datePart) : undefined
            if (packageDownloaded(packageURL)) {
                if (!!date)
                    updateDate(packageURL, date)
                else
                    console.log("Package already downloaded and no date to update:", packageURL)
            } else {
                await processDownload(packageURL, date)
            }
        }
    }
}

downloadLegacyPackages('legacy-archive.txt', downloadBeatmapPackage, changeDate)