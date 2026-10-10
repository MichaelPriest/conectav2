'use strict';
/**
 * Distribution-specific Android permissions:
 * - sideload (GitHub Releases): the user can download a verified APK and
 *   explicitly invoke the Android installer.
 * - play: REQUEST_INSTALL_PACKAGES is deliberately omitted, because Google
 *   Play prohibits ordinary social apps from self-updating via APK files.
 *   Play Store releases should use Play In-App Updates / store distribution.
 */
const base=require('./app.json').expo;
const play=process.env.EXPO_PUBLIC_CONECTA_DISTRIBUTION==='play';
module.exports={
 expo:{
  ...base,
  android:{
   ...base.android,
   permissions:play?[]:['android.permission.REQUEST_INSTALL_PACKAGES']
  }
 }
};
