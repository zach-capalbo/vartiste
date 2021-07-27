VARTISTE Hubs Connector
-----------------------

## Installation

 1. Clone the VARTISTE repository: `git clone https://gitlab.com/zach-geek/vartiste.git`
 2. `cd vartiste/hubs-connector`
 3. Install [nodejs LTS](https://nodejs.org/en/)
 4. `npm install`

## Running

First, launch the hubs bot:

```
node hubs-connector.js URL_OF_HUBS_ROOM
```

where `URL_OF_HUBS_ROOM` is the full url of the room you want the bot to enter.
A chromium window will pop up, and enter the lobby of the room.

At this point, you can go ahead and manually enter the room using the hubs UI.
Be sure to set your microphone and speakers, and give it the necessary permissions.

After this, open a Chrome browser window and go to [https://vartiste.xyz/?hubs=true](https://vartiste.xyz/?hubs=true)
Once the page loads, it should connect to the hubs bot. You can confirm this by
moving the camera around on the VARTISTE window (right click and drag), and you
should see the camera on the hubs bot window change to match the rotation.

Next, share the Hubs Bot window into VARTISTE:

  1. Click "More" on the Quick Menu
  2. Click Experiments / Utils
  3. Click "Show Desktop"
  4. Select the Hubs bot's Chromium window

Next, press F11 to make the VARTISTE window full screen.

Next, using alt-tab, go back to the Hubs bot window, and click Share -> Screen,
and then choose the VARTISTE window.

Now, alt-tab back to VARTISTE. Click VR on the bottom right to enter VR mode.

Now, click "Set Presentation Mode" on the "Experimental Functionality" shelf in
VARTISTE.

At this point it should be all set. Your movements in VR in VARTISTE will be
mirrored to Hubs. The canvas scale and location will also be mirrored in Hubs.
If you grab any pencil, it will turn into the one pencil  that's present in
Hubs. If someone else in hubs grabs the pencil, then it's location will be
mirrored back into VARTISTE, allowing them to draw with it.
