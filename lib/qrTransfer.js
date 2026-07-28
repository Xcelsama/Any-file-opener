// Pure helpers for the QR transfer feature. Deliberately no dynamic
// import() here — that only works when placed inline inside a 'use client'
// component in this build setup (see QrTransfer.jsx), matching how every
// other lazy-loaded library in this app (jszip, xlsx, mammoth, pdf-lib) is
// already loaded from within FileViewer.jsx/PdfViewer.jsx directly.

// Builds the URL a phone camera app will open when it scans the sender's QR.
export function buildReceiveUrl(peerId) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?receive=${encodeURIComponent(peerId)}`;
}

// Creates a Peer and resolves once it has an id assigned by the broker.
// Takes the already-loaded Peer constructor so the caller controls loading.
export function createPeer(Peer) {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });
    const onOpen = (id) => { cleanup(); resolve({ peer, id }); };
    const onError = (err) => { cleanup(); reject(err); };
    function cleanup() {
      peer.off('open', onOpen);
      peer.off('error', onError);
    }
    peer.on('open', onOpen);
    peer.on('error', onError);
  });
}

// Dials a remote peer id and resolves once the data connection is open.
export function connectToPeer(peer, remoteId) {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(remoteId.trim(), { reliable: true });
    if (!conn) { reject(new Error('Could not start a connection')); return; }
    const timeout = setTimeout(() => {
      reject(new Error('Connection timed out — check the code and that both devices are online'));
    }, 20000);
    conn.on('open', () => { clearTimeout(timeout); resolve(conn); });
    conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}
