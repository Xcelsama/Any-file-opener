import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xcelsama.anyfileviewer',
  appName: 'AnyFile Viewer',
  webDir: 'public',
  server: {
 url:'https://any-file-opener-ten.vercel.app/',
    cleartext: false,
  },
};

export default config;
