# Live View `play()` / new-load race findings

The browser reference confirms that `HTMLMediaElement.play()` is asynchronous and rejects when `src`, `srcObject`, `load()`, or `pause()` changes the media load before playback begins.

Session replay for the newly reported Live Camera session shows multiple **Go Live** clicks while startup was still unresolved. `startSession()` currently has no in-flight guard. Each call acquires a new `MediaStream`, assigns it to the same video element through `srcObject`, and awaits `video.play()`. A later click can replace `srcObject` before the earlier `play()` promise resolves, producing **“The play() request was interrupted by a new load request.”**

The repair should add a synchronous in-flight start lock, disable/rename the start button while permission and playback are being established, stop stale streams, and treat interruption-style `AbortError` results as superseded startup rather than a device-permission failure. The same guard should prevent duplicate replay auto-start and camera/screen start races.
