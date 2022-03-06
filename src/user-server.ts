import express from 'express'
import { keys, isNil } from 'lodash'

import { IUserInfo } from './data'

export interface IScoreSubmission {
    uniqueUserId : string
    serverPackageURL : string
    beatmapIndex : number
    score : number
    accuracy : number
    fc : boolean
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
    postHighScore : (scoreSubmission : IScoreSubmission) => Promise<boolean>,
    config: any
}
export const runUserServer = ({getUserInfoFromUniqueId, createNewUser, postHighScore, config} : IRunServerArguments) : Promise<void> => {
    const app = express()

    app.use(express.json())

    // Route that receives a POST request to /sms
    app.post('/user', (req, res) => {
        const body = req.body
        const id = body['id']
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

        if (!checkInvalidKeys(score, ['uniqueUserId', 'serverPackageURL', 'beatmapIndex', 'score', 'accuracy', 'fc'], missedKeys => {
            res.set('Content-Type', 'text/plain')
            res.send(`Missing/Invalid key values for score: ${missedKeys.join(',')}`)
        })) {
            postHighScore(score).then(newHighScore => {
                res.set('Content-Type', 'application/json')
                res.send({
                    'highscore': newHighScore
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
