'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, QrCode, Send, Download, Loader2, Check, AlertTriangle, Copy } from 'lucide-react';
import { createPeer, connectToPeer, buildReceiveUrl } from '../lib/qrTransfer';

// Peer-to-peer file transfer over WebRTC. The file goes straight from one
// browser to the other — this only uses a public broker (PeerJS's cloud
// signaling server) to help the two devices find each other, never to
// relay or store the file itself.
export default function QrTransfer({ open, onClose, activeFile, initialReceiveCode, onFileReceived }) {
  const [tab, setTab] = useState(initialReceiveCode ? 'receive' : 'send');
  const [sendStatus, setSendStatus] = useState('idle'); // idle | waiting | transferring | done | error
  const [sendError, setSendError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const [receiveCode, setReceiveCode] = useState(initialReceiveCode || '');
  const [recvStatus, setRecvStatus] = useState('idle'); // idle | connecting | transferring | done | error
  const [recvError, setRecvError] = useState('');
  const [recvFileName, setRecvFileName] = useState('');

  const sendPeerRef = useRef(null);
  const recvPeerRef = useRef(null);

  const destroyPeers = useCallback(() => {
    sendPeerRef.current?.destroy();
    recvPeerRef.current?.destroy();
    sendPeerRef.current = null;
    recvPeerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      destroyPeers();
      setSendStatus('idle'); setSendError(''); setQrDataUrl(null); setShareUrl(''); setCopied(false);
      setRecvStatus('idle'); setRecvError(''); setRecvFileName('');
    } else {
      setTab(initialReceiveCode ? 'receive' : 'send');
      setReceiveCode(initialReceiveCode || '');
    }
    return () => { if (!open) destroyPeers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => destroyPeers(), [destroyPeers]);

  const startSending = useCallback(async () => {
    if (!activeFile) return;
    setSendStatus('waiting');
    setSendError('');
    try {
      const { Peer } = await import('peerjs');
      const QRCode = await import('qrcode');
      const { peer, id } = await createPeer(Peer);
      sendPeerRef.current = peer;
      const url = buildReceiveUrl(id);
      setShareUrl(url);
      setQrDataUrl(await QRCode.toDataURL(url, {
        margin: 1,
        width: 260,
        color: { dark: '#0f172a', light: '#f8fafc' },
      }));

      peer.on('connection', (conn) => {
        conn.on('open', async () => {
          setSendStatus('transferring');
          try {
            const blob = await fetch(activeFile.url).then((r) => r.blob());
            const buffer = await blob.arrayBuffer();
            conn.send({ __qrMeta: true, name: activeFile.name, type: blob.type, size: buffer.byteLength });
            conn.send(buffer);
            conn.send({ __qrDone: true });
          } catch (err) {
            setSendStatus('error');
            setSendError(err?.message || 'Failed to read the file');
          }
        });
        conn.on('data', (data) => {
          if (data && data.__qrAck) setSendStatus('done');
        });
        conn.on('error', (err) => {
          setSendStatus('error');
          setSendError(err?.message || 'Connection lost');
        });
      });
      peer.on('error', (err) => {
        setSendStatus('error');
        setSendError(err?.message || 'Could not start the connection');
      });
    } catch (err) {
      setSendStatus('error');
      setSendError(err?.message || 'Could not start the connection');
    }
  }, [activeFile]);

  const startReceiving = useCallback(async () => {
    if (!receiveCode.trim()) return;
    setRecvStatus('connecting');
    setRecvError('');
    try {
      const { Peer } = await import('peerjs');
      const { peer } = await createPeer(Peer);
      recvPeerRef.current = peer;
      const conn = await connectToPeer(peer, receiveCode);
      setRecvStatus('transferring');
      let meta = null;
      conn.on('data', (data) => {
        if (data && data.__qrMeta) {
          meta = data;
          setRecvFileName(meta.name);
        } else if (data instanceof ArrayBuffer) {
          if (!meta) return;
          const blob = new Blob([data], { type: meta.type || 'application/octet-stream' });
          const file = new File([blob], meta.name, { type: meta.type, lastModified: Date.now() });
          onFileReceived?.(file);
        } else if (data && data.__qrDone) {
          setRecvStatus('done');
          conn.send({ __qrAck: true });
        }
      });
      conn.on('error', (err) => {
        setRecvStatus('error');
        setRecvError(err?.message || 'Connection lost');
      });
    } catch (err) {
      setRecvStatus('error');
      setRecvError(err?.message || 'Could not connect — check the code and try again');
    }
  }, [receiveCode, onFileReceived]);

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <QrCode size={16} className="text-amber-400" />
          <span className="text-sm font-medium text-slate-200 flex-1">Send to another device</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setTab('send')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${tab === 'send' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500'}`}
          >
            <Send size={13} /> Send
          </button>
          <button
            onClick={() => setTab('receive')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${tab === 'receive' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500'}`}
          >
            <Download size={13} /> Receive
          </button>
        </div>

        <div className="p-4">
          {tab === 'send' && (
            <div>
              {!activeFile && (
                <p className="text-xs text-slate-500 text-center py-6">Open a file first, then send it here.</p>
              )}
              {activeFile && sendStatus === 'idle' && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-3">
                    Send <span className="text-slate-200 font-medium">{activeFile.name}</span> straight to another
                    device — no upload, it travels directly between the two browsers.
                  </p>
                  <button
                    onClick={startSending}
                    className="w-full py-2 rounded-md bg-amber-400 text-slate-900 text-xs font-medium hover:bg-amber-300"
                  >
                    Generate code
                  </button>
                </div>
              )}
              {activeFile && sendStatus !== 'idle' && (
                <div className="flex flex-col items-center gap-3">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="Scan to receive" className="rounded-lg border border-slate-700" width={200} height={200} />
                  )}
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] text-slate-400 truncate"
                    />
                    <button onClick={copyLink} className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 flex-shrink-0">
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <StatusLine status={sendStatus} error={sendError}
                    labels={{ waiting: 'Waiting for the other device to scan…', transferring: 'Sending…', done: 'Delivered', error: sendError }} />
                </div>
              )}
            </div>
          )}

          {tab === 'receive' && (
            <div>
              {recvStatus === 'idle' && (
                <div>
                  <p className="text-xs text-slate-400 mb-3 text-center">
                    Scan the QR code shown on the other device with your camera app, or paste the code below.
                  </p>
                  <input
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value)}
                    placeholder="Paste code…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 mb-2 outline-none focus:border-amber-400/50"
                  />
                  <button
                    onClick={startReceiving}
                    disabled={!receiveCode.trim()}
                    className="w-full py-2 rounded-md bg-amber-400 text-slate-900 text-xs font-medium hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Connect
                  </button>
                </div>
              )}
              {recvStatus !== 'idle' && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <StatusLine status={recvStatus} error={recvError}
                    labels={{
                      connecting: 'Connecting…',
                      transferring: recvFileName ? `Receiving ${recvFileName}…` : 'Receiving…',
                      done: `${recvFileName || 'File'} received and opened`,
                      error: recvError,
                    }} />
                  {recvStatus === 'done' && (
                    <button onClick={onClose} className="mt-2 text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ status, labels }) {
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400 text-center">
        <AlertTriangle size={13} className="flex-shrink-0" /> {labels.error || 'Something went wrong'}
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
        <Check size={13} /> {labels.done}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <Loader2 size={13} className="animate-spin" /> {labels[status]}
    </div>
  );
}
