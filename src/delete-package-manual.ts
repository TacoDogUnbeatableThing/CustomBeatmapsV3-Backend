import { deletePackage } from './db'

const args = process.argv.slice(2);

if (args.length != 1) {
    console.log("Usage: delete-package-manual <package-filename.zip>")
} else {
    console.log("DELETING ", args[0])
    deletePackage(args[0])
}

