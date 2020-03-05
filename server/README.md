# Personal~~NBN~~Server

## Abstract
Personal~~NBN~~Server (hereafter referred to as PersonalServer) is a minimalist file-serving server for the NBN protocol.

It's been extracted from the CDN server to allow people to use NBN at home for file transfers. 

PersonalServer is designed to run be ONLY your own, secure, network -- therefore if it in someway can be compromised to expose files outside of the public folder there will be no danger.

If you choose to run this software you take all security responsibilities upon yourself.

**YOU HAVE BEEN WARNED**

## To Run
Requires Node JS v12.

Run `npm start`, will serve files from the public folder.

Currently `config.json` support is missing, this is coming soon.

Server listens on all interfaces (`0.0.0.0`), port `48128`.

## Contributors Note
This server is mostly the same as the server used to run the main NBN CDN, but missing a bunch of the additional service integration from the `/src/cdn` folder. PersonalServer **pull requests** will be entertained, but only if they don't conflict with the main NBNServer functions since running NextBestNetwork is our primary concern regarding this software. We trust you understand.

