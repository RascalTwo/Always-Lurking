# [Always Lurking](https://always-lurking.rascaltwo.com/)

[![Website](https://img.shields.io/website?url=https://always-lurking.rascaltwo.com/&label=Website)](https://always-lurking.rascaltwo.com/)

Keeping up with more then a few Twitch streamers can be difficult, from manually tracking schedules, to watching multiple at once, the process isn't scalable. Notifications only solve part of the issue - and are only useful if you don't miss said notification.

This is the issue *Always Lurking* solves, by always keeping a single browser tab opened here, users can view all streamers as they go online and offline without having to lift a finger. All that's required is the initial setup of adding groups and usernames of who you want to keep track of. Even if streamers aren't added to the list, the user can fully customize their experience to show any streamer they desire.

With the added ability of being able to participate in whichever chat the user desires, and to open each player in new windows for even further player customization.

## Installing

Comprised of an Express backend server and React frontend - both built with Typescript and communicating via WebSockets - the installation steps are as such:

```shell
npm install
npm run build
cd client # Change to the `client` directory
npm install
npm run build
cd .. # Back in the root directory
npm run start # To start the application
```

## Config

With only two credentials needed from Twitch.tv - obtain these after creating your application as you see fit, or by using one of the various Twitch OAuth Token generators:

```
TWITCH_CLIENT_ID=
TWITCH_OAUTH_TOKEN=
```

In addition - only if you plan on hosting the site, which is required for the instant detection of streams going online and offline:

```
HOSTNAME=
SUBSCRIPTION_SECRET=
```

where `HOSTNAME` is the hostname of the site, and `SUBSCRIPTION_SECRET` is the Twitch Webhook subscription secret.
