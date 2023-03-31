export function LogTask(commandLine,schema:DramaSchema){
    let counter={
        text:0,
        image:0,
        lottie:0,
        video:0,
        audio:0
    }
    schema?.layers?.forEach(layer=>{
        layer?.items?.forEach(item=>{
            counter[item.type]++
        })
    })
    console.log('\u001b[45m ============= FFMPEG TASK ============= \u001b[0m');
    console.log('\u001b[96m command line start:\u001b[0m')
    console.log(commandLine);
    console.log('\u001b[96m command line end \u001b[0m');
    console.table({
        duration:schema.d,
        width:schema.w,
        height:schema.h,
        ...counter
    })
    console.log('\u001b[45m ============= FFMPEG TASK ============= \u001b[0m');
}