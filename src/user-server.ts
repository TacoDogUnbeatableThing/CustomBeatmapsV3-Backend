import express from 'express'
import { keys, isNil } from 'lodash'

import { IUserInfo } from './data'

export interface IScoreSubmission {
    uniqueUserId : string
    beatmapKey : string
    score : number
    accuracy : number
    fc : number
}

const checkInvalidKeys = (obj : any, keysToCheck : string[], onFail : (keys : string[]) => void) : boolean => {
    keysToCheck = keysToCheck.filter(key => !(key in obj))
    if (keysToCheck.length != 0) {
        onFail(keysToCheck)
        return true;
    }
    return false;
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
            res.set('Content-Type', 'text/plain')
            res.send("Must provide JSON with 'id' key")
            return
        }
        getUserInfoFromUniqueId(id).then(userInfo => {
            res.set('Content-Type', 'application/json')
            res.send(userInfo)
        }).catch(err => {
            res.set('Content-Type', 'text/plain')
            res.send(err)
        })
    })

    app.post('/newuser', (req, res) => {
        const body = req.body
        const username = body['username']
        if (!username) {
            res.set('Content-Type', 'text/plain')
            res.send("Must provide JSON with 'username' key")
            return
        }
        const usernameType = typeof username
        if (usernameType !== "string" ) {
            res.set('Content-Type', 'text/plain')
            res.send(`Invalid type for 'username': ${usernameType}`)
            return
        }
        createNewUser(username).then(uniqueId => {
            res.set('Content-Type', 'application/json')
            res.send({
                'id': uniqueId
            })
        }).catch(err => {
            res.set('Content-Type', 'text/plain')
            res.send(err)
        })
    })

    app.post('/score', (req, res) => {
        const body = req.body
        const score : IScoreSubmission = body

        if (!checkInvalidKeys(score, ['uniqueUserId', 'beatmapKey', 'score', 'accuracy', 'fc'], missedKeys => {
            res.set('Content-Type', 'text/plain')
            res.send(`Missing/Invalid key values for score: ${missedKeys.join(',')}`)
        })) {
            console.log("GOT SCORE: ", score)
            postHighScore(score).then(() => {
                res.set('Content-Type', 'application/json')
                res.send({
                    'highscore': false
                })
            }).catch(err => {
                res.set('Content-Type', 'text/plain')
                res.send(err)
            })
        }
    })

    const port = config["user-server-port"]

    return new Promise(resolve => {
        app.listen(port, () => {
            console.log(`User Server started on port ${port}`)
            resolve()
        })
    })
}
