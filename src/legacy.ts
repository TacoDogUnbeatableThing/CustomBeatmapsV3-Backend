import { readFileSync } from "fs";

import { startDatabase, stopDatabase, downloadBeatmapPackage } from "./db";

// Processes each line of a "legacy download list" file, to help us deal with this.
const downloadLegacyPackages = async (downloadsFilePath : string, processDownload : (download : string) => void) => {
    const lines = readFileSync(downloadsFilePath, 'utf8').split('\n')
    for (const line of lines) {
        if (!line.startsWith('#'))
            await processDownload(line)
    }
}

downloadLegacyPackages('legacy-archive.txt', downloadBeatmapPackage)