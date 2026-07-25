import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xcelsama.anyfileviewer',
  appName: 'AnyFile Viewer',
  webDir: 'public',
  server: {
    // TODO: replace with your real Vercel URL before building
    url: 'https://your-app.vercel.app',
    cleartext: false,
  },
};

export default config;
