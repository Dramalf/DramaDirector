const DramaCore = require('../dist').default
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