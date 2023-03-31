# DramaDirector
Nodejs video/lottie/audio/text/image schema composition service based on FFmpeg
## 🐾 Example
* Start the demo
```Shell
npm i
npm run build
npm run demo
```
* 【optional】By excuting `npm run demo 1` , generate the video by stream mode.
* Then you can see **demo.mp4** in example folder.

https://user-images.githubusercontent.com/43701793/229109890-c33b6968-5309-4260-901b-690a781b1ff5.mp4


## 💫 How to generate a schema for your own composition?
You can refer to the schema.js in the demo folde. The example in this file includes the basic attributes required for the basic elements in video composition.

Basically, the schema comprises basic info(name,width,height,duration) and layers info. And each layer comprises several or single items.

### 💾 Layer
* index: id of this layer 
* type: **normal**/**audio**/**lottie**/**text**
* items:items in this layer
### 💿 VideoItem
* id : id of this layer 
* type : **video**
* url : local path or network link of the resource
* config : the basic info of the item
  
| attr | type          | usage                                              |
| ---- | ------------- | -------------------------------------------------- |
| st   | number/srting | the start time of the item in the whole production |
| et   | number/srting | the end time of the item in the whole production   |
| seek | number/srting | from which second does the item start playing      |
| x    | number/srting | position x                                         |
| y    | number/srting | position y                                         |
* effects : the effects on the items(filters like scale,blur, follow the rule of fluent-ffmpeg)

  | attr    | type          | usage            |
  | ------- | ------------- | ---------------- |
  | nm      | string        | name of filter   |
  | options | string/object | option of filter |

### 🎇 ImageItem
* id : id of this layer 
* type : **image**
* url : local path or network link of the resource
* config: the basic info of the item
* effects : the effects on the items(filters like scale,blur, follow the rule of fluent-ffmpeg)

### 🎊 LottieItem
* id : id of this layer 
* type : **lottie**
* **lottie** : object of lottieJson
* config: the basic info of the item
  
| attr | type          | usage                                              |
| ---- | ------------- | -------------------------------------------------- |
| st   | number/srting | the start time of the item in the whole production |
| et   | number/srting | the end time of the item in the whole production   |
| seek | number/srting | from which second does the item start playing      |
| x    | number/srting | position x                                         |
| y    | number/srting | position y                                         |
| fps  | number/srting | frame rate                                         |
| w    | number/srting | width, currently needed                            |
| h    | number/srting | height, currently needed                           |
* effects : 【**TODO**】the effects on the items(filters like crop,blur, follow the rule of fluent-ffmpeg)

### 🎼 TextItem
* id : id of this layer 
* type : **text**
* url : local path or network link of the resource
* config: the basic info of the item
  
| attr        | type          | usage                                              |
| ----------- | ------------- | -------------------------------------------------- |
| st          | number/srting | the start time of the item in the whole production |
| et          | number/srting | the end time of the item in the whole production   |
| text        | string        | text                                               |
| fontcolor   | string        | color of text                                      |
| fontsize    | number/string | size of font                                       |
| bordercolor | string        | color of inner border                              |
| borderw     | number/string | width of inner border                              |
| obc         | string        | color of outer border                              |
| obw         | number/string | color of outer border                              |
| ttfPath     | string        | local path of .ttf file                            |
  * effects : the effects on the items(filters like scale, follow the rule of fluent-ffmpeg)
### 🎼 AudioItem
* id : id of this layer 
* type : **lottie**
* url : local path or network link of the resource
* config: the basic info of the item
  
| attr | type          | usage                                              |
| ---- | ------------- | -------------------------------------------------- |
| st   | number/srting | the start time of the item in the whole production |
| et   | number/srting | the end time of the item in the whole production   |
| seek | number/srting | from which second does the item start playing      |

  * effects : the effects on the items(filters like volume, follow the rule of fluent-ffmpeg)


By using ffmpeg-utils in effects, you can even achieve the effect of keyframe animation.

## Consume the schema
* `npm i dramadirector` 
```javascript
const DramaCore = require('dramadirector').default
// The schema described how the product is organized
const darmaSchema = require('./schema')
const path = require('path')
const fs = require('fs');
const [, , useStream] = process.argv;
async function run() {
    const saveFilePath=path.join(__dirname, 'demo.mp4');
    const director = new DramaCore(darmaSchema)
    console.time('task')
    if(useStream){
        const stream = director.getStream();
        const outputStream = fs.createWriteStream(saveFilePath);
        stream.pipe(outputStream);
        outputStream.on('finish', () => {
            console.timeEnd('task')
        })
    }else{
        director.save(saveFilePath).then(() => {
            console.timeEnd('task')
        }).catch(err => {
            console.log(err)
        });
    }
}
run()
```

