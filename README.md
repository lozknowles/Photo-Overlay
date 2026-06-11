# Photo Overlay

Photo Overlay is a browser-first rephotography app for historic buildings and village history walks.

It lets a user:

- load a historic photo from the archive
- view it like a transparent film over the live camera
- move, tilt, and align until the roofline and landmarks match
- save the current viewpoint
- capture a new shot
- compare then/now with a slider
- download a simple comparison image
- scroll through a deck of historic photos on the walk
- load extra gallery photos from a local Collingham folder

## Run locally

For the full photo-deck experience, run the bundled Node server:

```bash
node server.js
```

By default it looks for gallery photos in:

`C:\Users\lozkn\OneDrive\Documents\CDLHS\JRdigitisation\CollinghamPictures`

You can point it somewhere else with `PHOTO_OVERLAY_GALLERY_DIR`.

If you only want the built-in sample frame, serve the folder from the project root with any static server. For example:

```bash
python -m http.server 4178
```

Then open `http://127.0.0.1:4178/`.

## Notes

- The first version uses standard browser APIs for camera, geolocation, and orientation.
- Capacitor can be added later if the project needs tighter native permissions or device integration.
