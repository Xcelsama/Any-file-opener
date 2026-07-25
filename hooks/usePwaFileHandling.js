'use client';

import { useEffect } from 'react';

/**
 * Wires up the two ways this app can be launched with a file already attached:
 *  1. The web File Handling API (`window.launchQueue`) — desktop PWA installs
 *     on Chromium browsers (Windows/macOS/Linux/ChromeOS). Not supported on
 *     Android as of Chrome's current implementation.
 *  2. The native Capacitor "FileHandler" plugin — used only inside the
 *     Android APK build, where Android's own VIEW intent hands us a file.
 *
 * Both branches are no-ops when their respective platform API isn't present,
 * so this hook is safe to call unconditionally from any build target
 * (plain web, installed PWA, or the Capacitor Android app).
 *
 * @param {(fileList: File[] | FileList) => void} handleFiles
 */
export default function usePwaFileHandling(handleFiles) {
  // Desktop PWA File Handling API
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files || !launchParams.files.length) return;
      const openedFiles = await Promise.all(
        launchParams.files.map((fileHandle) => fileHandle.getFile())
      );
      handleFiles(openedFiles);
    });
  }, [handleFiles]);

  // Android native "Open with" bridge (Capacitor build only)
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return;

    let listenerHandle;
    let cancelled = false;

    // NOTE: must be `window.File` here, not the bare `File` global — this
    // module could be bundled alongside code that imports an icon or helper
    // literally named `File` (e.g. lucide-react's File icon), which would
    // silently shadow the real constructor and throw "is not a constructor".
    const toFile = ({ name, mimeType, data }) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new window.File([bytes], name || 'file', { type: mimeType || 'application/octet-stream' });
    };

    import('@capacitor/core').then(({ registerPlugin }) => {
      if (cancelled) return;
      const FileHandler = registerPlugin('FileHandler');

      FileHandler.getLaunchFile().then((result) => {
        if (result?.name) handleFiles([toFile(result)]);
      });

      FileHandler.addListener('fileOpened', (result) => {
        handleFiles([toFile(result)]);
      }).then((handle) => { listenerHandle = handle; });
    });

    return () => {
      cancelled = true;
      listenerHandle?.remove();
    };
  }, [handleFiles]);
}
