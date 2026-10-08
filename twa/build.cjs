// Baut die Android-App (Trusted Web Activity): die App öffnet unser Spiel im Vollbild und lädt Updates direkt von der Website.
const fs=require('fs'),path=require('path');
const {TwaManifest,TwaGenerator,Config,JdkHelper,AndroidSdkTools,GradleWrapper,ConsoleLog}=require('@bubblewrap/core');
(async()=>{const log=new ConsoleLog('apk');const vc=parseInt(process.env.VC||'1',10);
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'twa-manifest.json'),'utf8'));data.appVersionCode=vc;data.appVersionName='1.0.'+vc;
 const twa=new TwaManifest(data);const dir=path.resolve('build-android');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
 await new TwaGenerator().createTwaProject(dir,twa,log);
 const config=new Config(process.env.JAVA_HOME,process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT);
 const jdk=new JdkHelper(process,config);const sdk=await AndroidSdkTools.create(process,config,jdk,log);
 try{await sdk.installBuildTools()}catch(e){log.warn('installBuildTools: '+e.message)}
 const gradle=new GradleWrapper(process,sdk,dir);await gradle.assembleRelease();
 const unsigned=path.join(dir,'app/build/outputs/apk/release/app-release-unsigned.apk'),aligned=path.join(dir,'aligned.apk');
 await sdk.zipalignOptimize(unsigned,aligned);const pw=process.env.KS_PW,ks=path.resolve('android.keystore');
 await sdk.apksigner(ks,pw,'fortlings',pw,aligned,path.resolve('Fortlings.apk'));
 log.info('Fertig: Fortlings.apk')})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
