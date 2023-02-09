import { downloadBeatmapPackage } from './db'

const args = process.argv.slice(2);

if (args.length != 2) {
    console.log("Usage: download-package-manual <url-to-package-zip> <name-of-package>")
} else {
    console.log("downloading url ", args[0], "to ", args[1])
    downloadBeatmapPackage(args[0], args[1])
}

