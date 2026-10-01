# Getting Started Guide

## Get access

First, ask someone with access to the server to add your public SSH key to the server (`~/.ssh/authorized_keys`)

## SSH into the server

The server's IP is `64.225.60.116` and the user is `root`

```sh
ssh root@64.225.60.116
```

I got this appended to my `~/.ssh/config` to make SSHing easier

```sh
Host custombeatmaps
  HostName 64.225.60.116
  User root
  IdentityFile [Path to my private key here]
```

so then I can just do

```sh
ssh custombeatmaps
```

## Services

There are 2 services running:

1. ### `custombeatmapsv3`
    
    runs the discord bot and the write endpoints (so the submission system, high scores, uploading and verifying maps etc.)
2. ### `custombeatmapsv3-public`

    Runs the public http server, that which you can access by going to http://64.225.60.116:8080

These are run using `systemd` and the service configurations can be found under `/etc/systemd/system/`

## Starting/Stopping/Checking services

`systemctl [status/start/stop/restart] [custombeatmapsv3/custombeatmapsv3-public]`

Pretty self explanatory. For example run `systemctl status custombeatmapsv3` to view a simple status, mostly just to check if it's running or not.

Services automatically run when the server starts up after a shutdown or reboot. If you `stop` a service and restart the server, the service will run start again on startup. If you really want to stop the service for good use `systemctl disable`, and to re-enable it use `systemctl enable`.

## The backend

The public server publishes everything under `CustomBeatmapsv3-Backend/db/public`. The only thing that's private is the mapping of user id to a user's name (because otherwise users can easily impersonate/submit scores on behalf of anyone. Not a huge deal but still)

There are a few scripts that might be useful, you can view them under `CustomBeatmapsv3-Backend/package.json`. No documentation on how they work but feel free to run them with `yarn run <command name here>`
