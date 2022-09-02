import express from 'express'
import Filter from 'bad-words'
import { IUserInfo } from './data'

import { logger } from './publiclogger'

export interface IScoreSubmission {
    uniqueUserId : string
    beatmapKey : string
    score : number
    accuracy : number
    fc : number
}

const badWordFilter = new Filter()

const checkInvalidKeys = (obj : any, keysToCheck : string[], onFail : (keys : string[]) => void) : boolean => {
    keysToCheck = keysToCheck.filter(key => !(key in obj))
    if (keysToCheck.length != 0) {
        onFail(keysToCheck)
        return true;
    }
    return false;
}

const returnError = (res: any, msg : string) => {
    res.set('Content-Type', 'text/plain')
    res.send(msg)
}

interface IRunServerArguments {
    getUserInfoFromUniqueId : (userUniqueId : string) => Promise<IUserInfo>,
    createNewUser : (username : string) => Promise<string>,
    postHighScore : (scoreSubmission : IScoreSubmission) => Promise<void>,
    config: any
}
export const runUserServer = ({getUserInfoFromUniqueId, createNewUser, postHighScore, config} : IRunServerArguments) : Promise<void> => {
    const app = express()

    app.use(express.json())

    // A simple "ping" screen
    app.get('/', (req, res) => res.send("OK"))

    // Route that receives a POST request to /sms
    app.post('/user', (req, res) => {
        const body = req.body
        const id = body['id']
        if (!id) {
            returnError(res, "Must provide JSON with 'id' key")
            return
        }
        getUserInfoFromUniqueId(id).then(userInfo => {
            res.set('Content-Type', 'application/json')
            res.send(userInfo)
        }).catch(err => {
            returnError(res, err)
        })
    })

    app.post('/newuser', (req, res) => {
        const body = req.body
        const username = body['username']
        if (!username) {
            returnError(res, "Must provide JSON with 'username' key")
            return
        }
        if (badWordFilter.isProfane(username)) {
            returnError(res, "Username is detected as profane")
            return
        }
        const usernameType = typeof username
        if (usernameType !== "string" ) {
            returnError(res, `Invalid type for 'username': ${usernameType}`)
            return
        }
        if (username.length > 20) {
            returnError(res, `Username must be 20 characters or less (yours is ${username.length})`)
            return
        }
        createNewUser(username).then(uniqueId => {
            res.set('Content-Type', 'application/json')
            res.send({
                'id': uniqueId
            })
        }).catch(err => {
            returnError(res, err)
        })
    })

    app.post('/score', (req, res) => {
        const body = req.body
        const score : IScoreSubmission = body

        if (!checkInvalidKeys(score, ['uniqueUserId', 'beatmapKey', 'score', 'accuracy', 'fc'], missedKeys => {
            returnError(res, `Missing/Invalid key values for score: ${missedKeys.join(',')}`)
            return;
        }))
        if (score['beatmapKey'] == null) {
            returnError(res, `No beatmap key provided!`)
            return;
        }
        postHighScore(score).then(() => {
            res.set('Content-Type', 'application/json')
            res.send({
                'highscore': false
            })
        }).catch(err => {
            returnError(res, err)
        })
    })

    const port = config["user-server-port"]

    return new Promise(resolve => {
        app.listen(port, () => {
            logger.info(`User Server started on port ${port}`)
            resolve()
        })
    })
}
